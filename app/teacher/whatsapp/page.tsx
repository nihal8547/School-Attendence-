import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import ConnectPanel from './ConnectPanel';

export const dynamic = 'force-dynamic';

export default async function WhatsAppPage() {
  const s = await requireRole('teacher');
  const [me] = await q(`SELECT wa_status FROM att.users WHERE id = $1`, [s.uid]);
  return (
    <>
      <h1>My WhatsApp</h1>
      <p className="muted">Parent messages are sent from your own WhatsApp number. Scan the QR code with WhatsApp → Settings → Linked devices → Link a device.</p>
      <ConnectPanel initial={me?.wa_status === 'connected' ? 'connected' : 'disconnected'} />
    </>
  );
}
