'use server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/academic';
import { queueNotices } from '@/lib/notify';

const GENERIC = 'If that account has a WhatsApp number, a 6-digit code was sent. It can take up to a minute. If nothing arrives, ask your school admin to reset your password.';

export async function requestOtp(formData: FormData) {
  await ensureSchema();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const step2 = `/forgot?step=2&email=${encodeURIComponent(email)}`;
  if (!email) redirect('/forgot?err=' + encodeURIComponent('Enter your email'));

  // old codes (they are stored in the message text) never stay around
  await q(`DELETE FROM att.notice_log WHERE kind = 'otp' AND created_at < now() - interval '1 hour'`);

  const [u] = await q<{ id: number; phone: string | null }>(`SELECT id, phone FROM att.users WHERE email = $1`, [email]);
  if (u?.phone) {
    const [recent] = await q(`SELECT 1 FROM att.password_resets WHERE user_id = $1 AND expires_at > now() + interval '9 minutes'`, [u.id]);
    if (!recent) {
      // send from this user's own WhatsApp if connected, otherwise from any connected teacher
      const [sender] = await q<{ id: number }>(
        `SELECT c.id FROM att.classes c JOIN att.users t ON t.id = c.teacher_id
         WHERE t.wa_status = 'connected' ORDER BY (t.id = $1) DESC, c.id LIMIT 1`,
        [u.id]
      );
      if (sender) {
        const otp = String(randomInt(100000, 1000000));
        await q(
          `INSERT INTO att.password_resets (user_id, otp_hash, expires_at, attempts) VALUES ($1, $2, now() + interval '10 minutes', 0)
           ON CONFLICT (user_id) DO UPDATE SET otp_hash = EXCLUDED.otp_hash, expires_at = EXCLUDED.expires_at, attempts = 0`,
          [u.id, await bcrypt.hash(otp, 8)]
        );
        await queueNotices('otp', [
          {
            classId: sender.id,
            phone: u.phone,
            refId: u.id,
            text: `🔐 *Password reset code*\n\nYour code is *${otp}*. It expires in 10 minutes. Do not share it with anyone.\n\n– School Attendance`,
          },
        ]);
      }
    }
  }
  redirect(`${step2}&ok=${encodeURIComponent(GENERIC)}`);
}

export async function resetWithOtp(formData: FormData) {
  await ensureSchema();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const otp = String(formData.get('otp') || '').trim();
  const next = String(formData.get('next') || '');
  const again = String(formData.get('again') || '');
  const back = (m: string): never => redirect(`/forgot?step=2&email=${encodeURIComponent(email)}&err=${encodeURIComponent(m)}`);
  if (next.length < 8) back('New password must be at least 8 characters');
  if (next !== again) back('The two passwords do not match');

  const [r] = await q<{ user_id: number; otp_hash: string; attempts: number; valid: boolean }>(
    `SELECT pr.user_id, pr.otp_hash, pr.attempts, pr.expires_at > now() AS valid
     FROM att.password_resets pr JOIN att.users u ON u.id = pr.user_id WHERE u.email = $1`,
    [email]
  );
  if (!r || !r.valid || r.attempts >= 5) back('The code has expired or is not valid. Request a new one.');
  if (!(await bcrypt.compare(otp, r.otp_hash))) {
    await q(`UPDATE att.password_resets SET attempts = attempts + 1 WHERE user_id = $1`, [r.user_id]);
    back('Wrong code. Please check and try again.');
  }
  await q(`UPDATE att.users SET password_hash = $2 WHERE id = $1`, [r.user_id, await bcrypt.hash(next, 10)]);
  await q(`DELETE FROM att.password_resets WHERE user_id = $1`, [r.user_id]);
  await q(`DELETE FROM att.notice_log WHERE kind = 'otp' AND ref_id = $1`, [r.user_id]);
  redirect('/login?reset=1');
}
