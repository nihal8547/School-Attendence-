import * as account from './account.js';
import * as academic from './academic.js';
import * as academic2 from './academic2.js';
import * as fees from './fees.js';
import * as groups from './groups.js';
import * as sup from './super.js';
import * as announce from './announce.js';
import * as holidays from './holidays.js';
import * as reportcards from './reportcards.js';
import * as admin from './admin.js';
import * as forgot from './forgot.js';
import type { FormLike } from '../compat.js';

export type ActionFn = (f: FormLike) => Promise<unknown>;

function pick(mod: Record<string, unknown>): Record<string, ActionFn> {
  const out: Record<string, ActionFn> = {};
  for (const [k, v] of Object.entries(mod)) if (typeof v === 'function') out[k] = v as ActionFn;
  return out;
}

export const actions: Record<string, ActionFn> = {
  ...pick(account), ...pick(academic), ...pick(academic2), ...pick(fees), ...pick(groups), ...pick(sup),
  ...pick(announce), ...pick(holidays), ...pick(reportcards), ...pick(admin), ...pick(forgot),
};

/** Actions that work without being signed in (forgot password). */
export const publicActions = new Set(['requestOtp', 'resetWithOtp']);
