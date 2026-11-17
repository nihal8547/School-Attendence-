'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions).
import { runAction } from '@/lib/api';

export async function sendReportCards(formData: FormData) {
  return runAction('sendReportCards', formData);
}

