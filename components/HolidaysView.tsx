import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { addHoliday, deleteHoliday } from '@/lib/holiday-actions';
import { fmtDate } from '@/lib/format';
import ConfirmButton from './ConfirmButton';

export default async function HolidaysView({ role, searchParams }: { role: 'admin' | 'teacher'; searchParams: { ok?: string; err?: string } }) {
  await requireRole(role);
  const { today, rows } = await getData<{ today: string; rows: { id: number; d: string; name: string; dow: string }[] }>('holidays');
  const upcoming = rows.filter((r) => r.d >= today);
  const past = rows.filter((r) => r.d < today).reverse();

  const table = (list: typeof rows, canDelete: boolean) => (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr><th>Date</th><th>Day</th><th>Holiday</th>{canDelete && <th />}</tr>
        </thead>
        <tbody>
          {list.map((h) => (
            <tr key={h.id}>
              <td>{fmtDate(h.d)}</td>
              <td>{h.dow}</td>
              <td><strong>{h.name}</strong></td>
              {canDelete && (
                <td style={{ textAlign: 'right' }}>
                  <form action={deleteHoliday}>
                    <input type="hidden" name="id" value={h.id} />
                    <button type="submit" className="danger" style={{ padding: '6px 12px' }}>Remove</button>
                  </form>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Holiday Calendar</h1>
        <p className="muted" style={{ margin: 0 }}>Attendance cannot be marked on a holiday. Parents can be notified on WhatsApp.</p>
      </div>
      {searchParams.ok && <div className="msg">✓ {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err">✕ {searchParams.err}</div>}

      {role === 'admin' && (
        <div className="card">
          <h2>Add holiday</h2>
          <form action={addHoliday} className="row">
            <label style={{ flex: 2 }}>
              Holiday name
              <input name="name" placeholder="e.g. Onam, Diwali, Republic Day" required maxLength={80} />
            </label>
            <label>
              From
              <input type="date" name="from" defaultValue={today} required />
            </label>
            <label>
              To (optional)
              <input type="date" name="to" />
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', minWidth: 240 }}>
              <input type="checkbox" name="notify" style={{ width: 20, minHeight: 20 }} />
              Notify all parents on WhatsApp
            </label>
            <button type="submit">Save Holiday</button>
          </form>
          <p className="hint">Use From and To for a range such as a vacation. Saving the same date again renames it.</p>
        </div>
      )}

      <div className="card">
        <h2>Upcoming</h2>
        {upcoming.length ? table(upcoming, role === 'admin') : <p className="muted">No upcoming holidays.</p>}
      </div>
      {past.length > 0 && (
        <div className="card">
          <h2>Recent (last 60 days)</h2>
          {table(past, role === 'admin')}
        </div>
      )}
    </>
  );
}
