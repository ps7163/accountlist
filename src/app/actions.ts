'use server';

/* 页面调用的服务端操作：先校验登录，再交给 lib/ops 执行（MCP 接口也复用 lib/ops） */

import { requireAuth } from '@/lib/auth';
import * as ops from '@/lib/ops';

export type { Result, SubInput, EmailInput, PayInput, NoteInput, TrashType } from '@/lib/ops';

export async function saveSubscription(...a: Parameters<typeof ops.saveSubscription>) {
  await requireAuth();
  return ops.saveSubscription(...a);
}
export async function deleteSubscription(...a: Parameters<typeof ops.deleteSubscription>) {
  await requireAuth();
  return ops.deleteSubscription(...a);
}
export async function markRenewed(...a: Parameters<typeof ops.markRenewed>) {
  await requireAuth();
  return ops.markRenewed(...a);
}
export async function cancelSubscription(...a: Parameters<typeof ops.cancelSubscription>) {
  await requireAuth();
  return ops.cancelSubscription(...a);
}
export async function convertTrial(...a: Parameters<typeof ops.convertTrial>) {
  await requireAuth();
  return ops.convertTrial(...a);
}
export async function snoozeSubscription(...a: Parameters<typeof ops.snoozeSubscription>) {
  await requireAuth();
  return ops.snoozeSubscription(...a);
}
export async function clearSnoozes(...a: Parameters<typeof ops.clearSnoozes>) {
  await requireAuth();
  return ops.clearSnoozes(...a);
}
export async function getSubDetail(...a: Parameters<typeof ops.getSubDetail>) {
  await requireAuth();
  return ops.getSubDetail(...a);
}
export async function addPayment(...a: Parameters<typeof ops.addPayment>) {
  await requireAuth();
  return ops.addPayment(...a);
}
export async function deletePayment(...a: Parameters<typeof ops.deletePayment>) {
  await requireAuth();
  return ops.deletePayment(...a);
}
export async function setUsage(...a: Parameters<typeof ops.setUsage>) {
  await requireAuth();
  return ops.setUsage(...a);
}
export async function keepSubscription(...a: Parameters<typeof ops.keepSubscription>) {
  await requireAuth();
  return ops.keepSubscription(...a);
}
export async function finishReview(...a: Parameters<typeof ops.finishReview>) {
  await requireAuth();
  return ops.finishReview(...a);
}
export async function saveEmail(...a: Parameters<typeof ops.saveEmail>) {
  await requireAuth();
  return ops.saveEmail(...a);
}
export async function deleteEmail(...a: Parameters<typeof ops.deleteEmail>) {
  await requireAuth();
  return ops.deleteEmail(...a);
}
export async function savePayMethod(...a: Parameters<typeof ops.savePayMethod>) {
  await requireAuth();
  return ops.savePayMethod(...a);
}
export async function deletePayMethod(...a: Parameters<typeof ops.deletePayMethod>) {
  await requireAuth();
  return ops.deletePayMethod(...a);
}
export async function saveNote(...a: Parameters<typeof ops.saveNote>) {
  await requireAuth();
  return ops.saveNote(...a);
}
export async function deleteNote(...a: Parameters<typeof ops.deleteNote>) {
  await requireAuth();
  return ops.deleteNote(...a);
}
export async function restoreItem(...a: Parameters<typeof ops.restoreItem>) {
  await requireAuth();
  return ops.restoreItem(...a);
}
export async function purgeItem(...a: Parameters<typeof ops.purgeItem>) {
  await requireAuth();
  return ops.purgeItem(...a);
}
export async function emptyTrash(...a: Parameters<typeof ops.emptyTrash>) {
  await requireAuth();
  return ops.emptyTrash(...a);
}
export async function savePrefs(...a: Parameters<typeof ops.savePrefs>) {
  await requireAuth();
  return ops.savePrefs(...a);
}
export async function batchSubs(...a: Parameters<typeof ops.batchSubs>) {
  await requireAuth();
  return ops.batchSubs(...a);
}
