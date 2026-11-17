'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';

// Re-fetches the server page on an interval (paused while the tab is hidden).
export default function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => { if (!document.hidden) { router.refresh(); setT(new Date().toLocaleTimeString()); } };
    const id = setInterval(tick, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return (
    <button type="button" className="ghost" onClick={() => { router.refresh(); setT(new Date().toLocaleTimeString()); }}>
      <Icon n="retry" /> Refresh{t ? ` (${t})` : ''}
    </button>
  );
}
