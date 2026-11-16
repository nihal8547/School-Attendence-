'use client';

import { useEffect } from 'react';

// On phones, plain tables are shown as stacked cards. The column titles are copied from the
// header row into each cell (data-label) here, so the pages themselves stay simple.
// Tables with class no-stack / tt-grid / marks-table stay as scrollable grids.
function label(root: ParentNode) {
  root.querySelectorAll('table').forEach((t) => {
    if (t.matches('.no-stack, .tt-grid, .marks-table')) return;
    const heads = Array.from(t.querySelectorAll('thead th')).map((h) => (h.textContent || '').trim());
    if (!heads.length) return;
    t.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((td, i) => {
        if (!td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i] || '');
      });
    });
    t.setAttribute('data-stack', '1');
  });
}

export default function MobileTables() {
  useEffect(() => {
    label(document);
    let raf = 0;
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => label(document));
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
