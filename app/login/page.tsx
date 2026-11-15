import { login } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className="login-card">
      <div className="login-header">
        <div className="brand-logo-icon large">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </div>
        <h1>School Attendance</h1>
        <p className="login-subtitle">Sign in to your dashboard</p>
      </div>

      {error && (
        <div className="msg err">
          Invalid email or password. Please try again.
        </div>
      )}

      <form action={login} className="stack">
        <label>
          Email Address
          <input
            name="email"
            type="email"
            placeholder="teacher@school.com"
            required
            autoFocus
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            placeholder="••••••••"
            required
          />
        </label>

        <button type="submit" style={{ width: '100%', marginTop: 8 }}>
          Sign In
        </button>
      </form>
    </div>
  );
}
