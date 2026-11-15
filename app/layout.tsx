import type { Viewport } from 'next';
import './globals.css';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'School Attendance | WhatsApp Alerts',
  description: 'Daily student attendance with automated WhatsApp alerts to parents',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();

  return (
    <html lang="en">
      <body>
        {s ? (
          <AppShell user={{ uid: s.uid, name: s.name, role: s.role }}>
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
