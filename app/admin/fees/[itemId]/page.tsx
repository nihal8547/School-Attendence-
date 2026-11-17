import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { recordPayment, sendFeeReminders, setConcession } from '@/lib/fee-actions';
import { fmtDate, fmtMoney } from '@/lib/format';
import ConfirmButton from '@/components/ConfirmButton';
import { updateFeeItem } from '@/lib/edit-actions';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ itemId: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole('admin');
  const { itemId } = await params;
  const sp = await searchParams;
  const id = Number(itemId);
  const { item, rows, today } = await getData<{
    item: { id: number; name: string; amount: string; due_date: string | null; class_name: string };
    rows: { due_id: number; roll_no: number; name: string; amount: string; concession: string; paid: string; last_payment: number | null }[];
    today: string;
  }>('fee-item', { id });
  const bal = (r: (typeof rows)[number]) => Number(r.amount) - Number(r.concession) - Number(r.paid);
  const billed = rows.reduce((a, r) => a + Number(r.amount) - Number(r.concession), 0);
  const paid = rows.reduce((a, r) => a + Number(r.paid), 0);
  const pending = rows.filter((r) => bal(r) > 0.001).length;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/fees" className="muted"><Icon n="arrow-left" /> All fees</Link>
        <h1 style={{ marginTop: 6 }}>{item.name} · {item.class_name}</h1>
        <p className="muted" style={{ margin: 0 }}>{fmtMoney(item.amount)} per student · Due {fmtDate(item.due_date)}</p>
      </div>
      {sp.ok && <div className="msg"><Icon n="check" /> {sp.ok}</div>}
      {sp.err && <div className="msg err"><Icon n="x" /> {sp.err}</div>}

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}><Icon n="note" /> Edit fee</summary>
        <form action={updateFeeItem} className="row" style={{ marginTop: 12 }}>
          <input type="hidden" name="id" value={id} />
          <label>Fee name<input name="name" defaultValue={item.name} required maxLength={80} /></label>
          <label>Amount per student<input name="amount" type="number" step="0.01" min="1" defaultValue={Number(item.amount)} required /></label>
          <label>Due date<input name="due_date" type="date" defaultValue={item.due_date ? String(item.due_date).slice(0, 10) : ''} /></label>
          <button type="submit">Save</button>
        </form>
        <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>Amount cannot be changed once payments are recorded.</p>
      </details>

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
              <ConfirmButton message={`Send a WhatsApp fee reminder to parents of ${pending} student(s)?`}><Icon n="send" /> Remind all pending ({pending})</ConfirmButton>
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
                    <td data-label="Status">{b <= 0.001 ? <><Icon n="check-circle" /> Paid</> : Number(r.paid) > 0 ? <><Icon n="half" /> Partial</> : <><Icon n="x-circle" /> Pending</>}</td>
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
                              <button type="submit" className="ghost"><Icon n="send" /> Remind parent</button>
                            </form>
                          )}
                          {r.last_payment && <Link className="btn ghost" href={`/admin/fees/receipt/${r.last_payment}`}><Icon n="receipt" /> Last receipt</Link>}
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
