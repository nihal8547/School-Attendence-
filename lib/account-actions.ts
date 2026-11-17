'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions).
import { runAction } from '@/lib/api';

export async function changePassword(formData: FormData) {
  return runAction('changePassword', formData);
}

export async function updateProfile(formData: FormData) {
  return runAction('updateProfile', formData);
}

export async function saveSchool(formData: FormData) {
  return runAction('saveSchool', formData);
}

export async function adminResetPassword(formData: FormData) {
  return runAction('adminResetPassword', formData);
}

