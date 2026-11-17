import { AsyncLocalStorage } from 'node:async_hooks';
import type { Session } from './lib/session.js';

export const als = new AsyncLocalStorage<{ session: Session | null; reqId: string }>();
export const currentSession = () => als.getStore()?.session ?? null;
