'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';

export default function ImportUpload({ classId }: { classId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; warn?: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch('/api/students/import', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setRes({ ok: true, warn: j.warn, text: j.message });
        (e.target as HTMLFormElement).reset();
        router.refresh();
      } else setRes({ ok: false, text: j.error || 'Import failed' });
    } catch {
      setRes({ ok: false, text: 'Network error, try again' });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="stack">
      <input type="hidden" name="class_id" value={classId} />
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label style={{ flex: 1 }}>
          Excel (.xlsx) or CSV file
          <input type="file" name="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        </label>
        <button type="submit" disabled={busy}><Icon n="upload" /> {busy ? 'Importing...' : 'Upload & Import'}</button>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <a className="badge ok" href="/api/students/template?fmt=xlsx" style={{ textDecoration: 'none' }}><Icon n="download" /> Excel template</a>
        <a className="badge ok" href="/api/students/template?fmt=csv" style={{ textDecoration: 'none' }}><Icon n="download" /> CSV template</a>
      </div>
      {res && (
        <div className={`msg ${res.ok && !res.warn ? '' : 'err'}`}><Icon n={res.ok && !res.warn ? 'check' : 'x'} /> {res.text}</div>
      )}
    </form>
  );
}
