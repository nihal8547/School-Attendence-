import { q } from './db.js';
import { callN8n } from './n8n.js';

export type WaStatus = 'connected' | 'disconnected';

/** Save the status in the dashboard's own database so every page agrees. */
export async function saveWaStatus(uid: number, status: WaStatus) {
  await q(`UPDATE att.users SET wa_status = $2, instance_name = $3 WHERE id = $1`, [uid, status, `att_teacher_${uid}`]);
}

/**
 * Ask Evolution (through n8n) for the real connection state and keep the DB in sync.
 * If n8n cannot be reached, fall back to the last saved value.
 */
export async function getLiveWaStatus(uid: number): Promise<WaStatus> {
  try {
    const r = await callN8n('attendance-wa', { action: 'status', teacher_id: uid });
    const live = r.ok ? r.data?.wa_status : null;
    if (live === 'connected' || live === 'disconnected') {
      await saveWaStatus(uid, live);
      return live;
    }
  } catch {
    /* fall through to saved value */
  }
  const [u] = await q(`SELECT wa_status FROM att.users WHERE id = $1`, [uid]);
  return u?.wa_status === 'connected' ? 'connected' : 'disconnected';
}
