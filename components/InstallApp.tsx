'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/Icon';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = 'sa-install-snooze';

// Install popup: shown once when the app is installable (Android/Chrome) or on iPhone; "Not now" snoozes it for 7 days.
export default function InstallApp() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (standalone) return;
    let snoozed = false;
    try { snoozed = Date.now() < Number(localStorage.getItem(KEY) || 0); } catch { /* ignore */ }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (isIos && !snoozed) t = setTimeout(() => setOpen(true), 2500);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      if (!snoozed) setOpen(true);
    };
    const onInstalled = () => { setOpen(false); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function later() {
    try { localStorage.setItem(KEY, String(Date.now() + 7 * 864e5)); } catch { /* ignore */ }
    setOpen(false);
  }

  if (!open || (!evt && !ios)) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={later}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon"><Icon n="smartphone" size={26} /></div>
        <h3 id="install-title">Install School Attendance</h3>
        <p className="muted">Add the app to your home screen for quick access and a full-screen experience.</p>
        {!evt && ios && (
          <p className="install-help">Tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={later}>Not now</button>
          {evt && (
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await evt.prompt();
                setEvt(null);
              }}
            >
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
