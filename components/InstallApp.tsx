'use client';

import React, { useEffect, useState } from 'react';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// "Install app" button: uses the browser prompt on Android/Chrome, shows Add-to-Home-Screen steps on iPhone.
export default function InstallApp({ className = '' }: { className?: string }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!evt && !ios)) return null;

  return (
    <div className={`install-app ${className}`}>
      <button
        type="button"
        className="ghost install-btn"
        onClick={async () => {
          if (evt) {
            await evt.prompt();
            setEvt(null);
          } else {
            setHelp((v) => !v);
          }
        }}
      >
        📲 Install app
      </button>
      {help && (
        <div className="install-help">
          Tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.
        </div>
      )}
    </div>
  );
}
