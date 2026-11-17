import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { ensureSchema } from '@/lib/academic';
import { sendReceipt } from '@/lib/fee-actions';
import { getSchool } from '@/lib/settings';
import { fmtDate, fmtMoney } from '@/lib/format';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ paymentId: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole('admin');
  await ensureSchema();
  const { paymentId } = await params;
  const sp = await searchParams;
  const pid = Number(paymentId);
  const [r] = await q<{ item_id: number; student: string; roll_no: number; class_name: string; item: string; amount: string; paid_on: string; method: string; note: string | null; balance: string }>(
    `SELECT fi.id AS item_id, s.name AS student, s.roll_no, c.name AS class_name, fi.name AS item, p.amount, to_char(p.paid_on, 'YYYY-MM-DD') AS paid_on, p.method, p.note,
            (d.amount - d.concession - COALESCE((SELECT SUM(amount) FROM att.fee_payments WHERE due_id = d.id), 0)) AS balance
     FROM att.fee_payments p JOIN att.fee_dues d ON d.id = p.due_id
     JOIN att.fee_items fi ON fi.id = d.fee_item_id JOIN att.students s ON s.id = d.student_id JOIN att.classes c ON c.id = fi.class_id
     WHERE p.id = $1`,
    [pid]
  );
  if (!r) notFound();
  const school = await getSchool();
  const row = (k: string, v: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #d1d5db' }}>
      <span style={{ color: '#6b7280' }}>{k}</span><strong>{v}</strong>
    </div>
  );
  return (
    <>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <Link href={`/admin/fees/${r.item_id}`} className="muted">← Back to fee</Link>
        {sp.ok && <div className="msg">✓ {sp.ok}</div>}
        {sp.err && <div className="msg err">✕ {sp.err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <PrintButton />
          <form action={sendReceipt}>
            <input type="hidden" name="payment_id" value={pid} />
            <button type="submit">📲 Send to parent on WhatsApp</button>
          </form>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{school.name}</h2>
          {school.address && <div className="muted">{school.address}</div>}
          <div style={{ marginTop: 8, fontWeight: 700, letterSpacing: 1 }}>FEE RECEIPT</div>
        </div>
        {row('Receipt no.', `#${String(pid).padStart(5, '0')}`)}
        {row('Date', fmtDate(r.paid_on))}
        {row('Student', r.student)}
        {row('Class / Roll', `${r.class_name} / ${r.roll_no}`)}
        {row('Fee', r.item)}
        {row('Payment mode', r.method.toUpperCase())}
        {r.note ? row('Note', r.note) : null}
        {row('Amount paid', fmtMoney(r.amount))}
        {row('Balance after payment', Number(r.balance) > 0.001 ? fmtMoney(r.balance) : 'Nil (fully paid)')}
        <p className="muted" style={{ textAlign: 'center', marginTop: 16, fontSize: 12 }}>This is a computer generated receipt.</p>
      </div>
    </>
  );
}
