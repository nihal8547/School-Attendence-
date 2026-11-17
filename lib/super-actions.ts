'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions).
import { runAction } from '@/lib/api';

export async function createSchool(formData: FormData) {
  return runAction('createSchool', formData);
}

export async function updateSchool(formData: FormData) {
  return runAction('updateSchool', formData);
}

export async function setSchoolActive(formData: FormData) {
  return runAction('setSchoolActive', formData);
}

export async function setSchoolModules(formData: FormData) {
  return runAction('setSchoolModules', formData);
}

export async function addSchoolAdmin(formData: FormData) {
  return runAction('addSchoolAdmin', formData);
}

export async function resetAdminPassword(formData: FormData) {
  return runAction('resetAdminPassword', formData);
}

