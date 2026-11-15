'use client';

import React, { useEffect, useRef, useState } from 'react';

async function call(action: 'connect' | 'status' | 'logout') {
  const res = await fetch('/api/wa', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  return res.json();
}

export default function ConnectPanel({ initial }: { initial: 'connected' | 'disconnected' }) {
  const [status, setStatus] = useState(initial);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => stop, []);

  async function connect() {
    setBusy(true);
    setError('');
    const j = await call('connect');
    setBusy(false);
    if (!j.ok) return setError(j.error || 'Could not generate a QR code');
    const b64 = j.base64 as string | null;
    if (!b64) return setError('No QR code returned. If this number is already linked, click "Refresh Status".');
    setQr(b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`);
    stop();
    let tries = 0;
    timer.current = setInterval(async () => {
      tries++;
      const s = await call('status');
      if (s.wa_status === 'connected') {
        stop();
        setQr(null);
        setStatus('connected');
      } else if (tries > 40) {
        stop();
        setQr(null);
        setError('QR code expired. Click Connect WhatsApp again to refresh.');
      }
    }, 3000);
  }

  async function refresh() {
    setBusy(true);
    const s = await call('status');
    setBusy(false);
    if (s.ok) setStatus(s.wa_status === 'connected' ? 'connected' : 'disconnected');
  }

  async function disconnect() {
    if (!confirm('Disconnect WhatsApp? Parent alert notifications will stop until you reconnect.')) return;
    setBusy(true);
    await call('logout');
    setBusy(false);
    setStatus('disconnected');
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Device Connection</h2>
        <span className={`badge ${status === 'connected' ? 'ok' : 'bad'}`}>
          {status === 'connected' ? '● Connected' : '○ Disconnected'}
        </span>
      </div>

      <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>
        To link your WhatsApp: Open WhatsApp on your phone → tap <strong>Menu / Settings</strong> → tap{' '}
        <strong>Linked Devices</strong> → tap <strong>Link a Device</strong> and scan the QR code below.
      </p>

      {error && <div className="msg err">{error}</div>}

      {qr && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
          <img className="qr" src={qr} alt="WhatsApp QR Code" />
          <span className="muted">Waiting for you to scan the QR code…</span>
        </div>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        {status !== 'connected' && (
          <button type="button" onClick={connect} disabled={busy}>
            {busy ? 'Generating QR…' : 'Connect WhatsApp'}
          </button>
        )}
        <button type="button" className="ghost" onClick={refresh} disabled={busy}>
          {busy ? 'Checking…' : 'Refresh Status'}
        </button>
        {status === 'connected' && (
          <button type="button" className="danger" onClick={disconnect} disabled={busy}>
            Disconnect Device
          </button>
        )}
      </div>
    </div>
  );
}
