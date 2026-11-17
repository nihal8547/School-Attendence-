'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions).
import { runAction } from '@/lib/api';

export async function createFeeItem(formData: FormData) {
  return runAction('createFeeItem', formData);
}

export async function deleteFeeItem(formData: FormData) {
  return runAction('deleteFeeItem', formData);
}

export async function setConcession(formData: FormData) {
  return runAction('setConcession', formData);
}

export async function recordPayment(formData: FormData) {
  return runAction('recordPayment', formData);
}

export async function sendFeeReminders(formData: FormData) {
  return runAction('sendFeeReminders', formData);
}

export async function sendReceipt(formData: FormData) {
  return runAction('sendReceipt', formData);
}

