'use server';
// Thin proxy: the logic lives in the API server (backend/src/actions).
import { runAction } from '@/lib/api';

export async function addHomework(formData: FormData) {
  return runAction('addHomework', formData);
}

export async function deleteHomework(formData: FormData) {
  return runAction('deleteHomework', formData);
}

export async function addChapters(formData: FormData) {
  return runAction('addChapters', formData);
}

export async function setTopicStatus(formData: FormData) {
  return runAction('setTopicStatus', formData);
}

export async function deleteTopic(formData: FormData) {
  return runAction('deleteTopic', formData);
}

export async function addLeave(formData: FormData) {
  return runAction('addLeave', formData);
}

export async function decideLeave(formData: FormData) {
  return runAction('decideLeave', formData);
}

export async function deleteLeave(formData: FormData) {
  return runAction('deleteLeave', formData);
}

export async function addRemark(formData: FormData) {
  return runAction('addRemark', formData);
}

export async function deleteRemark(formData: FormData) {
  return runAction('deleteRemark', formData);
}

