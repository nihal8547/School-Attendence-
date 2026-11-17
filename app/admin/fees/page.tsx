import Link from 'next/link';
import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { createFeeItem, deleteFeeItem } from '@/lib/fee-actions';
import { fmtDate, fmtMoney } from '@/lib/format';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; class?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const cf = Number(sp.class) || null;
  const { classes, items } = await getData<{ classes: { id: number; name: string }[]; items: { id: number; class_name: string; name: string; amount: string; due_date: string | null; students: string; billed: string; paid: string }[] }>('fees', { class: sp.class });
  const billed = items.reduce((a, i) => a + Number(i.billed), 0);
  const paid = items.reduce((a, i) => a + Number(i.paid), 0);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Fees</h1>
        <p className="muted" style={{ margin: 0 }}>Create fees, record payments, print receipts and remind parents on WhatsApp.</p>
      </div>
      {sp.ok && <div className="msg"><Icon n="check" /> {sp.ok}</div>}
      {sp.err && <div className="msg err"><Icon n="x" /> {sp.err}</div>}

      <div className="stat-grid">
        <div className="stat-box"><div className="n">{fmtMoney(billed)}</div><div className="l">Total billed</div></div>
        <div className="stat-box"><div className="n" style={{ color: 'var(--green-ink, #15803d)' }}>{fmtMoney(paid)}</div><div className="l">Collected</div></div>
        <div className="stat-box"><div className="n" style={{ color: billed - paid > 0 ? 'var(--red-ink)' : undefined }}>{fmtMoney(billed - paid)}</div><div className="l">Pending</div></div>
      </div>

      <div className="card">
        <h2>Create a fee</h2>
        <form action={createFeeItem} className="row filters">
          <label>Fee name<input name="name" placeholder="e.g. Term 1 Tuition" required maxLength={80} /></label>
          <label>Amount per student (₹)<input name="amount" type="number" min="1" step="0.01" required /></label>
          <label>Due date<input name="due_date" type="date" /></label>
          <label>
            Class
            <select name="class_id" defaultValue="all">
              <option value="all">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button type="submit">Create fee</button>
        </form>
        <p className="hint">The fee is added for every active student in the selected class(es). Concessions can be set per student.</p>
      </div>

      <div className="card">
        <form method="get" className="row filters" style={{ marginBottom: 12 }}>
          <label>
            Show class
            <select name="class" defaultValue={cf ?? ''}>
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button type="submit" className="ghost">Filter</button>
        </form>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Fee</th><th>Class</th><th>Due</th><th>Per student</th><th>Collected</th><th>Pending</th><th /></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td data-label="Fee"><Link href={`/admin/fees/${i.id}`}><strong>{i.name}</strong></Link></td>
                  <td data-label="Class">{i.class_name}</td>
                  <td data-label="Due">{fmtDate(i.due_date)}</td>
                  <td data-label="Per student">{fmtMoney(i.amount)}</td>
                  <td data-label="Collected">{fmtMoney(i.paid)}</td>
                  <td data-label="Pending" style={Number(i.billed) - Number(i.paid) > 0 ? { color: 'var(--red-ink)', fontWeight: 600 } : undefined}>{fmtMoney(Number(i.billed) - Number(i.paid))}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link className="btn ghost" href={`/admin/fees/${i.id}`}>Open</Link>{' '}
                    <form action={deleteFeeItem} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={i.id} />
                      <button type="submit" className="danger" style={{ padding: '6px 12px' }}>Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center' }}>No fees yet. Create one above.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
