'use client';

import React from 'react';
import { useFormStatus } from 'react-dom';

export default function ConfirmButton({
  message, children, className, style, pendingLabel = 'Working...',
}: { message: string; children: React.ReactNode; className?: string; style?: React.CSSProperties; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      style={{ minWidth: 160, ...style }}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
