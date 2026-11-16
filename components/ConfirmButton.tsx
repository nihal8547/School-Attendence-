'use client';

import React from 'react';
import { useFormStatus } from 'react-dom';

export default function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{ minWidth: 160 }}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {pending ? 'Sending…' : children}
    </button>
  );
}
