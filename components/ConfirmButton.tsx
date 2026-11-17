'use client';

import React, { useState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

/** Inner component that uses useFormStatus — must be a child of a <form>. */
function Inner({
  message, children, className, style, pendingLabel,
}: { message: string; children: React.ReactNode; className?: string; style?: React.CSSProperties; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      style={style}
      suppressHydrationWarning
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export default function ConfirmButton({
  message, children, className, style, pendingLabel = 'Working...',
}: { message: string; children: React.ReactNode; className?: string; style?: React.CSSProperties; pendingLabel?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // On the server (and first client paint) render a plain button with no
  // dynamic styles so server and client HTML always match.
  if (!mounted) {
    return (
      <button type="submit" className={className} style={style} suppressHydrationWarning>
        {children}
      </button>
    );
  }

  return (
    <Inner
      message={message}
      className={className}
      style={{ minWidth: 160, ...style }}
      pendingLabel={pendingLabel}
    >
      {children}
    </Inner>
  );
}
