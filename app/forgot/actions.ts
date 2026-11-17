'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions).
import { runAction } from '@/lib/api';

export async function requestOtp(formData: FormData) {
  return runAction('requestOtp', formData);
}

export async function resetWithOtp(formData: FormData) {
  return runAction('resetWithOtp', formData);
}

