'use client';

import React, { useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-submit" disabled={pending}>
      {pending ? (
        <>
          <span className="auth-spinner" aria-hidden /> Signing in…
        </>
      ) : (
        'Sign in'
      )}
    </button>
  );
}

export default function LoginForm({ action, error }: { action: (formData: FormData) => void | Promise<void>; error: boolean }) {
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="auth-form">
      {error && (
        <div className="auth-alert" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Wrong email or password. Please try again.
        </div>
      )}

      <label className="auth-field">
        <span>Email address</span>
        <div className="auth-input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="3" /><path d="m22 7-10 6L2 7" />
          </svg>
          <input name="email" type="email" placeholder="you@school.com" autoComplete="username" required autoFocus />
        </div>
      </label>

      <label className="auth-field">
        <span>Password</span>
        <div className="auth-input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="3" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input name="password" type={show ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" required />
          <button type="button" className="auth-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>

      <Link href="/forgot" className="auth-forgot">Forgot password?</Link>

      <SubmitButton />
    </form>
  );
}
