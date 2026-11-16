import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'School Attendance',
    short_name: 'Attendance',
    description: 'Daily student attendance with automated WhatsApp alerts to parents',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#4f46e5',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Mark Attendance', short_name: 'Attendance', url: '/teacher/attendance', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Timetable', short_name: 'Timetable', url: '/teacher/timetable', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
