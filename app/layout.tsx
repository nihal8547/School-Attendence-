import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/open-sans';
import './globals.css';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import PwaRegister from '@/components/PwaRegister';
import MobileTables from '@/components/MobileTables';
import { getData } from '@/lib/api';

export const metadata: Metadata = {
  title: 'School Attendance | WhatsApp Alerts',
  description: 'Daily student attendance with automated WhatsApp alerts to parents',
  applicationName: 'School Attendance',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Attendance', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/favicon-64.png', sizes: '64x64', type: 'image/png' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#4f46e5',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  // Menu follows the modules switched on for this school (and the teacher's class groups).
  const nav = s && s.role !== 'superadmin' ? await getData<{ modules: string[]; schoolName: string }>('nav').catch(() => null) : null;
  const modules = nav?.modules;
  const schoolName = nav?.schoolName;

  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <MobileTables />
        {s ? (
          <AppShell user={{ uid: s.uid, name: s.name, role: s.role }} modules={modules} schoolName={schoolName}>
            {children}
          </AppShell>
        ) : (
          <div className="public-layout">
            <main>{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
