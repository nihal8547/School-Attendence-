import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { ensureSchema } from '@/lib/academic';
import { recordPayment, sendFeeReminders, setConcession } from '@/lib/fee-actions';
import { todayIST } from '@/lib/n8n';
import { fmtDate, fmtMoney } from '@/lib/format';
import ConfirmButton from '@/components/ConfirmButton';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ itemId: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const s = await requireRole('admin');
  await ensureSchema();
  const { itemId } = await params;
  const sp = await searchParams;
  const id = Number(itemId);
  const [item] = await q<{ id: number; name: string; amount: string; due_date: string | null; class_name: string }>(
    `SELECT fi.id, fi.name, fi.amount, to_char(fi.due_date, 'YYYY-MM-DD') AS due_date, c.name AS class_name
     FROM att.fee_items fi JOIN att.classes c ON c.id = fi.class_id WHERE fi.id = $1 AND c.school_id = $2`,
    [id, s.sid]
  );
  if (!item) notFound();
  const rows = await q<{ due_id: number; roll_no: number; name: string; amount: string; concession: string; paid: string; last_payment: number | null }>(
    `SELECT d.id AS due_id, s.roll_no, s.name, d.amount, d.concession,
            COALESCE((SELECT SUM(p.amount) FROM att.fee_payments p WHERE p.due_id = d.id), 0) AS paid,
            (SELECT MAX(p.id) FROM att.fee_payments p WHERE p.due_id = d.id) AS last_payment
     FROM att.fee_dues d JOIN att.students s ON s.id = d.student_id
     WHERE d.fee_item_id = $1 AND s.active ORDER BY s.roll_no, s.name`,
    [id]
  );
  const bal = (r: (typeof rows)[number]) => Number(r.amount) - Number(r.concession) - Number(r.paid);
  const billed = rows.reduce((a, r) => a + Number(r.amount) - Number(r.concession), 0);
  const paid = rows.reduce((a, r) => a + Number(r.paid), 0);
  const pending = rows.filter((r) => bal(r) > 0.001).length;
  const today = todayIST();

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/fees" className="muted">← All fees</Link>
        <h1 style={{ marginTop: 6 }}>{item.name} · {item.class_name}</h1>
        <p className="muted" style={{ margin: 0 }}>{fmtMoney(item.amount)} per student · Due {fmtDate(item.due_date)}</p>
      </div>
      {sp.ok && <div className="msg">✓ {sp.ok}</div>}
      {sp.err && <div className="msg err">✕ {sp.err}</div>}

      <div className="stat-grid">
        <div className="stat-box"><div className="n">{fmtMoney(billed)}</div><div className="l">Billed</div></div>
        <div className="stat-box"><div className="n">{fmtMoney(paid)}</div><div className="l">Collected</div></div>
        <div className="stat-box"><div className="n" style={pending ? { color: 'var(--red-ink)' } : undefined}>{fmtMoney(billed - paid)}</div><div className="l">Pending</div></div>
        <div className="stat-box"><div className="n">{pending}</div><div className="l">Students pending</div></div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Students</h2>
          {pending > 0 && (
            <form action={sendFeeReminders}>
              <input type="hidden" name="item_id" value={id} />
              <ConfirmButton message={`Send a WhatsApp fee reminder to parents of ${pending} student(s)?`}>📲 Remind all pending ({pending})</ConfirmButton>
            </form>
          )}
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Roll</th><th>Student</th><th>Fee</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const b = bal(r);
                return (
                  <tr key={r.due_id}>
                    <td data-label="Roll">{r.roll_no}</td>
                    <td data-label="Student"><strong>{r.name}</strong></td>
                    <td data-label="Fee">{fmtMoney(Number(r.amount) - Number(r.concession))}{Number(r.concession) > 0 && <span className="muted"> (−{fmtMoney(r.concession)})</span>}</td>
                    <td data-label="Paid">{fmtMoney(r.paid)}</td>
                    <td data-label="Balance" style={b > 0.001 ? { color: 'var(--red-ink)', fontWeight: 600 } : undefined}>{fmtMoney(b)}</td>
                    <td data-label="Status">{b <= 0.001 ? '✅ Paid' : Number(r.paid) > 0 ? '🟡 Partial' : '🔴 Pending'}</td>
                    <td>
                      <details>
                        <summary style={{ cursor: 'pointer' }}>Manage</summary>
                        <div style={{ display: 'grid', gap: 10, marginTop: 10, minWidth: 240 }}>
                          {b > 0.001 && (
                            <form action={recordPayment} style={{ display: 'grid', gap: 6 }}>
                              <input type="hidden" name="due_id" value={r.due_id} />
                              <input type="hidden" name="item_id" value={id} />
                              <input name="amount" type="number" step="0.01" min="1" max={b} defaultValue={b} required aria-label="Amount" />
                              <select name="method" defaultValue="cash" aria-label="Method">
                                <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option>
                                <option value="cheque">Cheque</option><option value="other">Other</option>
                              </select>
                              <input name="paid_on" type="date" defaultValue={today} aria-label="Paid on" />
                              <input name="note" placeholder="Note (optional)" maxLength={120} />
                              <button type="submit">Record payment</button>
                            </form>
                          )}
                          <form action={setConcession} style={{ display: 'flex', gap: 6 }}>
                            <input type="hidden" name="due_id" value={r.due_id} />
                            <input type="hidden" name="item_id" value={id} />
                            <input name="concession" type="number" step="0.01" min="0" defaultValue={r.concession} aria-label="Concession" style={{ flex: 1 }} />
                            <button type="submit" className="ghost">Set concession</button>
                          </form>
                          {b > 0.001 && (
                            <form action={sendFeeReminders}>
                              <input type="hidden" name="item_id" value={id} />
                              <input type="hidden" name="due_id" value={r.due_id} />
                              <button type="submit" className="ghost">📲 Remind parent</button>
                            </form>
                          )}
                          {r.last_payment && <Link className="btn ghost" href={`/admin/fees/receipt/${r.last_payment}`}>🧾 Last receipt</Link>}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center' }}>No students in this class.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
