import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import ConnectPanel from './ConnectPanel';

export const dynamic = 'force-dynamic';

export default async function WhatsAppPage() {
  await requireRole('teacher');
  const me = { wa_status: (await getData<{ waStatus: string }>('teacher-whatsapp')).waStatus };

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>WhatsApp Integration</h1>
        <p className="muted" style={{ margin: 0 }}>
          Parent messages are sent directly from your verified WhatsApp account to ensure parents recognize the sender.
        </p>
      </div>

      <ConnectPanel initial={me?.wa_status === 'connected' ? 'connected' : 'disconnected'} />
    </>
  );
}
