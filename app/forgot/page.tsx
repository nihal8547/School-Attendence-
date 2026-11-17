import Link from 'next/link';
import { requestOtp, resetWithOtp } from './actions';
import Icon from '@/components/Icon';

export const metadata = { title: 'Forgot password | School Attendance' };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ step?: string; email?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const step2 = sp.step === '2' && !!sp.email;

  return (
    <div className="auth-page" style={{ gridTemplateColumns: '1fr' }}>
      <section className="auth-main">
        <div className="auth-card">
          <h1>{step2 ? 'Enter the code' : 'Forgot password'}</h1>
          <p className="auth-sub">
            {step2 ? `We sent a 6-digit code to the WhatsApp number of ${sp.email}.` : 'Enter your sign-in email. We will send a code to your registered WhatsApp number.'}
          </p>

          {sp.ok && <div className="msg" style={{ marginBottom: 16 }}>{sp.ok}</div>}
          {sp.err && <div className="auth-alert" role="alert" style={{ marginBottom: 16 }}>{sp.err}</div>}

          {!step2 ? (
            <form action={requestOtp} className="auth-form">
              <label className="auth-field">
                <span>Email address</span>
                <div className="auth-input">
                  <input name="email" type="email" placeholder="you@school.com" autoComplete="username" required autoFocus />
                </div>
              </label>
              <button type="submit" className="auth-submit">Send code on WhatsApp</button>
            </form>
          ) : (
            <form action={resetWithOtp} className="auth-form">
              <input type="hidden" name="email" value={sp.email} />
              <label className="auth-field">
                <span>6-digit code</span>
                <div className="auth-input">
                  <input name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" autoComplete="one-time-code" required autoFocus />
                </div>
              </label>
              <label className="auth-field">
                <span>New password (8+ characters)</span>
                <div className="auth-input">
                  <input name="next" type="password" minLength={8} autoComplete="new-password" required />
                </div>
              </label>
              <label className="auth-field">
                <span>Repeat new password</span>
                <div className="auth-input">
                  <input name="again" type="password" minLength={8} autoComplete="new-password" required />
                </div>
              </label>
              <button type="submit" className="auth-submit">Reset password</button>
              <Link href="/forgot" className="auth-foot" style={{ margin: 0 }}>Send a new code</Link>
            </form>
          )}

          <p className="auth-foot"><Link href="/login"><Icon n="arrow-left" /> Back to sign in</Link></p>
        </div>
      </section>
    </div>
  );
}
