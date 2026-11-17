'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions).
import { runAction } from '@/lib/api';

export async function createTeacher(formData: FormData) {
  return runAction('createTeacher', formData);
}

export async function createClass(formData: FormData) {
  return runAction('createClass', formData);
}

export async function assignTeacher(formData: FormData) {
  return runAction('assignTeacher', formData);
}

export async function addStudent(formData: FormData) {
  return runAction('addStudent', formData);
}

export async function importStudents(formData: FormData) {
  return runAction('importStudents', formData);
}

export async function removeStudent(formData: FormData) {
  return runAction('removeStudent', formData);
}

export async function retryFailed(formData: FormData) {
  return runAction('retryFailed', formData);
}


export async function updateTeacher(formData: FormData) {
  return runAction('updateTeacher', formData);
}
