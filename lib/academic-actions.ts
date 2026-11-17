'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions).
import { runAction } from '@/lib/api';

export async function saveTimetable(formData: FormData) {
  return runAction('saveTimetable', formData);
}

export async function createExam(formData: FormData) {
  return runAction('createExam', formData);
}

export async function saveMarks(formData: FormData) {
  return runAction('saveMarks', formData);
}

export async function deleteExam(formData: FormData) {
  return runAction('deleteExam', formData);
}

export async function sendTimetable(formData: FormData) {
  return runAction('sendTimetable', formData);
}

export async function sendMarksheet(formData: FormData) {
  return runAction('sendMarksheet', formData);
}

