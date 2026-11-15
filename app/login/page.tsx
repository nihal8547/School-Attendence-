import { login } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="center card stack">
      <h1>Sign in</h1>
      {error && <div className="msg err">Wrong email or password.</div>}
      <form action={login} className="stack">
        <label>Email<input name="email" type="email" required autoFocus /></label>
        <label>Password<input name="password" type="password" required /></label>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
