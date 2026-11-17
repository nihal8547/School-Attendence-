import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { ensureSchema } from '@/lib/academic';
import { getSchool } from '@/lib/settings';
import { changePassword, updateProfile, saveSchool } from '@/lib/account-actions';

export default async function AccountView({ role, searchParams }: { role: 'admin' | 'teacher'; searchParams: { ok?: string; err?: string } }) {
  const s = await requireRole(role);
  await ensureSchema();
  const [u] = await q<{ name: string; email: string; phone: string | null }>(`SELECT name, email, phone FROM att.users WHERE id = $1`, [s.uid]);
  const school = role === 'admin' ? await getSchool() : null;
  const national = u.phone ? u.phone.replace(/^91/, '') : '';

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>{role === 'admin' ? 'Account & School' : 'My Account'}</h1>
        <p className="muted" style={{ margin: 0 }}>Your profile, password and sign-in recovery.</p>
      </div>
      {searchParams.ok && <div className="msg">✓ {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err">✕ {searchParams.err}</div>}

      <form action={updateProfile} className="card">
        <h2>Profile</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          <label>
            Name
            <input name="name" defaultValue={u.name} required maxLength={80} />
          </label>
          <label>
            Email (sign-in)
            <input value={u.email} readOnly disabled />
          </label>
          <label>
            WhatsApp number (India, 10 digits)
            <input name="phone" defaultValue={national} inputMode="numeric" placeholder="9876543210" />
          </label>
          <p className="hint" style={{ margin: 0 }}>This number receives your password reset code if you forget your password.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" style={{ minWidth: 160 }}>Save Profile</button>
          </div>
        </div>
      </form>

      <form action={changePassword} className="card">
        <h2>Change password</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          <label>
            Current password
            <input name="current" type="password" autoComplete="current-password" required />
          </label>
          <label>
            New password (8+ characters)
            <input name="next" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            Repeat new password
            <input name="again" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" style={{ minWidth: 160 }}>Change Password</button>
          </div>
        </div>
      </form>

      {school && (
        <form action={saveSchool} className="card">
          <h2>School details</h2>
          <p className="hint" style={{ marginTop: -6 }}>Shown on report cards, receipts and school-wide messages.</p>
          <div style={{ display: 'grid', gap: 14 }}>
            <label>
              School name
              <input name="school_name" defaultValue={school.name === 'School' ? '' : school.name} placeholder="e.g. St. Mary's School" required maxLength={100} />
            </label>
            <label>
              Address / phone line (optional)
              <input name="school_address" defaultValue={school.address} maxLength={200} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" style={{ minWidth: 160 }}>Save School</button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}
