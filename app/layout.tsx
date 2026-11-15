import './globals.css';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'School Attendance | WhatsApp Alerts',
  description: 'Daily student attendance with automated WhatsApp alerts to parents',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
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
