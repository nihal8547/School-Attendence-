'use client';

import React from 'react';

export default function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button type="button" className="ghost no-print" onClick={() => window.print()}>
      🖨 {label}
    </button>
  );
}
