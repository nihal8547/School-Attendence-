'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/login/actions';
import InstallApp from '@/components/InstallApp';

export interface AppShellProps {
  user: {
    uid: number;
    name: string;
    role: 'admin' | 'teacher';
  };
  children: React.ReactNode;
}

export default function AppShell({ user, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scrolling when mobile drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const Ic = ({ children }: { children: React.ReactNode }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
  const icons = {
    people: <Ic><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Ic>,
    cap: <Ic><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></Ic>,
    log: <Ic><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></Ic>,
    grid: <Ic><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Ic>,
    check: <Ic><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M9 16l2 2 4-4" /></Ic>,
    table: <Ic><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="4" x2="9" y2="22" /><line x1="15" y1="10" x2="15" y2="22" /></Ic>,
    marks: <Ic><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15l2 2 4-4" /></Ic>,
    wa: <Ic><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></Ic>,
    mega: <Ic><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></Ic>,
    sun: <Ic><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Ic>,
    chart: <Ic><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Ic>,
    rupee: <Ic><path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4 4 0 0 0 0-10" /></Ic>,
    user: <Ic><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Ic>,
  };

  type Item = { href: string; label: string; short: string; icon: React.ReactNode; exact: boolean; primary?: boolean };
  const adminNav: Item[] = [
    { href: '/admin', label: 'Teachers & Classes', short: 'Teachers', icon: icons.people, exact: true, primary: true },
    { href: '/admin/students', label: 'Students', short: 'Students', icon: icons.cap, exact: false, primary: true },
    { href: '/admin/fees', label: 'Fees', short: 'Fees', icon: icons.rupee, exact: false, primary: true },
    { href: '/admin/reports', label: 'Reports', short: 'Reports', icon: icons.chart, exact: false, primary: true },
    { href: '/admin/timetable', label: 'Timetable', short: 'Timetable', icon: icons.table, exact: false },
    { href: '/admin/marks', label: 'Mark Sheets', short: 'Marks', icon: icons.marks, exact: false },
    { href: '/admin/announcements', label: 'Announcements', short: 'Notices', icon: icons.mega, exact: false },
    { href: '/admin/holidays', label: 'Holidays', short: 'Holidays', icon: icons.sun, exact: false },
    { href: '/admin/logs', label: 'Message Log', short: 'Log', icon: icons.log, exact: false },
    { href: '/admin/account', label: 'Account & School', short: 'Account', icon: icons.user, exact: false },
  ];
  const teacherNav: Item[] = [
    { href: '/teacher', label: 'Dashboard', short: 'Home', icon: icons.grid, exact: true, primary: true },
    { href: '/teacher/attendance', label: 'Mark Attendance', short: 'Attendance', icon: icons.check, exact: true, primary: true },
    { href: '/teacher/timetable', label: 'Timetable', short: 'Timetable', icon: icons.table, exact: false, primary: true },
    { href: '/teacher/marks', label: 'Mark Sheets', short: 'Marks', icon: icons.marks, exact: false, primary: true },
    { href: '/teacher/announcements', label: 'Announcements', short: 'Notices', icon: icons.mega, exact: false },
    { href: '/teacher/holidays', label: 'Holidays', short: 'Holidays', icon: icons.sun, exact: false },
    { href: '/teacher/reports', label: 'Reports', short: 'Reports', icon: icons.chart, exact: false },
    { href: '/teacher/whatsapp', label: 'My WhatsApp', short: 'WhatsApp', icon: icons.wa, exact: false },
    { href: '/teacher/account', label: 'My Account', short: 'Account', icon: icons.user, exact: false },
  ];

  const navItems = user.role === 'admin' ? adminNav : teacherNav;

  const isActive = (itemHref: string, exact: boolean) => {
    if (exact) return pathname === itemHref;
    return pathname.startsWith(itemHref);
  };

  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="app-shell">
      {/* Mobile Top Navigation Bar */}
      <header className="mobile-header">
        <button
          type="button"
          className="menu-toggle-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="mobile-brand">
          <div className="brand-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <span className="mobile-brand-title">Attendence</span>
        </div>

        <div className="mobile-user-avatar" title={user.name}>
          {userInitial}
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop Persistent + Mobile Drawer) */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <div className="brand-text">
              <div className="brand-title">Attendence</div>
              <div className="brand-subtitle">School Portal</div>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* User Card in Sidebar */}
        <Link href={user.role === 'admin' ? '/admin/account' : '/teacher/account'} className="sidebar-user-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="user-avatar">{userInitial}</div>
          <div className="user-details">
            <div className="user-name">{user.name}</div>
            <span className={`user-role-badge ${user.role}`}>{user.role}</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-text">{item.label}</span>
                {active && <span className="nav-active-pill" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer with Logout */}
        <div className="sidebar-footer">
          <InstallApp />
          <form action={logout}>
            <button type="submit" className="logout-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="content-area">
        <main className="main-container">{children}</main>
      </div>

      {/* Phone bottom navigation */}
      <nav className="bottom-nav" aria-label="Main">
        {navItems
          .filter((item) => item.primary)
          .map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link key={item.href} href={item.href} className={`bottom-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                <span className="bottom-icon">{item.icon}</span>
                <span className="bottom-text">{item.short}</span>
              </Link>
            );
          })}
        <button type="button" className={`bottom-link more ${navItems.some((i) => !i.primary && isActive(i.href, i.exact)) ? 'active' : ''}`} onClick={() => setSidebarOpen(true)}>
          <span className="bottom-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
          </span>
          <span className="bottom-text">More</span>
        </button>
      </nav>
    </div>
  );
}

