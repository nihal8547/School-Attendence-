'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions/edits.ts).
import { runAction } from '@/lib/api';

export async function setTeacherActive(formData: FormData) {
  return runAction('setTeacherActive', formData);
}

export async function deleteTeacher(formData: FormData) {
  return runAction('deleteTeacher', formData);
}

export async function updateClass(formData: FormData) {
  return runAction('updateClass', formData);
}

export async function deleteClass(formData: FormData) {
  return runAction('deleteClass', formData);
}

export async function updateStudent(formData: FormData) {
  return runAction('updateStudent', formData);
}

export async function updateFeeItem(formData: FormData) {
  return runAction('updateFeeItem', formData);
}

export async function deletePayment(formData: FormData) {
  return runAction('deletePayment', formData);
}

export async function updateExam(formData: FormData) {
  return runAction('updateExam', formData);
}

export async function updateHomework(formData: FormData) {
  return runAction('updateHomework', formData);
}
