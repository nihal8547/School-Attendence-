'use client';
import { useEffect, useRef, useState } from 'react';

async function call(action: 'connect' | 'status' | 'logout') {
  const res = await fetch('/api/wa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
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
    if (!j.ok) return setError(j.error || 'Could not get a QR code');
    const b64 = j.base64 as string | null;
    if (!b64) return setError('No QR returned. If this number is already linked, press Refresh status.');
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
        setError('QR expired. Press Connect again.');
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
    if (!confirm('Disconnect WhatsApp? Parent messages will stop until you reconnect.')) return;
    setBusy(true);
    await call('logout');
    setBusy(false);
    setStatus('disconnected');
  }

  return (
    <div className="card stack">
      <div>
        Status: <span className={`badge ${status === 'connected' ? 'ok' : 'bad'}`}>{status}</span>
      </div>
      {error && <div className="msg err">{error}</div>}
      {qr && <img className="qr" src={qr} alt="WhatsApp QR code" />}
      <div className="row">
        {status !== 'connected' && <button onClick={connect} disabled={busy}>{busy ? 'Please wait…' : 'Connect WhatsApp'}</button>}
        <button className="ghost" onClick={refresh} disabled={busy}>Refresh status</button>
        {status === 'connected' && <button className="danger" onClick={disconnect} disabled={busy}>Disconnect</button>}
      </div>
    </div>
  );
}
