import './globals.css';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { logout } from './login/actions';

export const metadata = { title: 'School Attendance', description: 'Daily attendance with WhatsApp parent alerts' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <html lang="en">
      <body>
        {s && (
          <header className="top">
            <strong>📋 School Attendance</strong>
            {s.role === 'admin' ? (
              <>
                <Link href="/admin">Teachers &amp; Classes</Link>
                <Link href="/admin/students">Students</Link>
                <Link href="/admin/logs">Message Log</Link>
              </>
            ) : (
              <>
                <Link href="/teacher">Attendance</Link>
                <Link href="/teacher/whatsapp">My WhatsApp</Link>
              </>
            )}
            <span className="sp" />
            <span>{s.name}</span>
            <form action={logout}>
              <button className="ghost" type="submit">Logout</button>
            </form>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
