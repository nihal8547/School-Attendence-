'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions).
import { runAction } from '@/lib/api';

export async function addHoliday(formData: FormData) {
  return runAction('addHoliday', formData);
}

export async function deleteHoliday(formData: FormData) {
  return runAction('deleteHoliday', formData);
}

