'use client';

import React from 'react';

export default function AutoSubmitForm({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <form className={className} method="get" onChange={(e) => e.currentTarget.requestSubmit()}>
      {children}
    </form>
  );
}
