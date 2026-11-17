import { createHmac, timingSafeEqual } from 'node:crypto';

const secret = () => process.env.SESSION_SECRET || 'dev-only-secret';

export function signToken(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function verifyToken(payload: string, sig: string): boolean {
  const good = Buffer.from(signToken(payload));
  const got = Buffer.from(String(sig || ''));
  return good.length === got.length && timingSafeEqual(good, got);
}
