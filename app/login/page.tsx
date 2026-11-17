import { login } from './actions';
import LoginForm from './LoginForm';
import InstallApp from '@/components/InstallApp';

export const metadata = { title: 'Sign in | School Attendance' };

const features = [
  { t: 'Two-time daily attendance', d: 'Mark morning and afternoon in a few taps.' },
  { t: 'Instant WhatsApp alerts', d: 'Parents get a Present or Absent message right away.' },
  { t: 'Every message tracked', d: 'See what was sent, and retry anything that failed.' },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const { error, reset } = await searchParams;

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-brand">
          <span className="auth-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </span>
          <span>School Attendance</span>
        </div>

        <div className="auth-hero">
          <h2>Attendance that reaches parents in seconds.</h2>
          <p>One simple dashboard for teachers and school admins.</p>
          <ul>
            {features.map((f) => (
              <li key={f.t}>
                <span className="auth-tick">✓</span>
                <div>
                  <strong>{f.t}</strong>
                  <span>{f.d}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <span className="auth-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </span>
            <span>School Attendance</span>
          </div>

          <h1>Welcome back</h1>
          <p className="auth-sub">Sign in to continue to your dashboard.</p>

          {reset && <div className="msg" style={{ marginBottom: 16 }}>✓ Password changed. Please sign in with your new password.</div>}
          <LoginForm action={login} error={!!error} />

          <InstallApp className="auth-install" />

          <p className="auth-foot">Don&apos;t have an account? Ask your school admin to add you.</p>
        </div>
      </section>
    </div>
  );
}
