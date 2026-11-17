import { q } from './db.js';
import { callN8n } from './n8n.js';

export type Notice = {
  classId: number;
  studentId?: number | null;
  phone: string;
  text: string;
  refId?: number | null;
  mediaUrl?: string | null;
  mediaName?: string | null;
};

/**
 * Stores messages in att.notice_log and asks n8n ("send-notices") to send that batch one by one,
 * from each class teacher's WhatsApp. Returns false if n8n could not be started.
 */
export async function queueNotices(kind: string, items: Notice[], examId: number | null = null): Promise<{ ok: boolean; count: number }> {
  if (!items.length) return { ok: true, count: 0 };
  const batch = crypto.randomUUID();
  await q(
    `INSERT INTO att.notice_log (batch, kind, class_id, exam_id, student_id, phone, text, ref_id, media_url, media_name)
     SELECT $1, $2, x.cid, $3, x.sid, x.ph, x.tx, x.rid, x.mu, x.mn
     FROM unnest($4::int[], $5::int[], $6::text[], $7::text[], $8::int[], $9::text[], $10::text[]) AS x(cid, sid, ph, tx, rid, mu, mn)`,
    [
      batch,
      kind,
      examId,
      items.map((i) => i.classId),
      items.map((i) => i.studentId ?? null),
      items.map((i) => i.phone),
      items.map((i) => i.text),
      items.map((i) => i.refId ?? null),
      items.map((i) => i.mediaUrl ?? null),
      items.map((i) => i.mediaName ?? null),
    ]
  );
  const r = await callN8n('send-notices', { batch });
  return { ok: r.ok, count: items.length };
}

/** Parents of active students (opted in), optionally for one class. One row per student and phone. */
export async function guardianTargets(schoolId: number, classId: number | null) {
  return q<{ class_id: number; student_id: number; student_name: string; class_name: string; phone: string; guardian_name: string | null }>(
    `SELECT s.class_id, s.id AS student_id, s.name AS student_name, c.name AS class_name, g.phone, g.name AS guardian_name
     FROM att.guardians g
     JOIN att.students s ON s.id = g.student_id AND s.active
     JOIN att.classes c ON c.id = s.class_id
     WHERE g.opt_in AND c.school_id = $1 AND ($2::int IS NULL OR s.class_id = $2)
     ORDER BY c.name, s.roll_no, s.id`,
    [schoolId, classId]
  );
}
