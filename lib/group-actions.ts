'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions).
import { runAction } from '@/lib/api';

export async function createGroup(formData: FormData) {
  return runAction('createGroup', formData);
}

export async function createDefaultGroups(formData: FormData) {
  return runAction('createDefaultGroups', formData);
}

export async function saveGroup(formData: FormData) {
  return runAction('saveGroup', formData);
}

export async function deleteGroup(formData: FormData) {
  return runAction('deleteGroup', formData);
}

export async function assignClassGroup(formData: FormData) {
  return runAction('assignClassGroup', formData);
}

