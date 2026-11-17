'use client';

import React from 'react';
import Icon from '@/components/Icon';

export default function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button type="button" className="ghost no-print" onClick={() => window.print()}>
      <Icon n="printer" /> {label}
    </button>
  );
}
