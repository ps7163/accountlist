'use server';

import QRCode from 'qrcode';
import { revalidatePath } from 'next/cache';
import { hashPassword, newTotpSecret, requireAuth, revokeOtherSessions, totpSecret, totpUri, verifyPassword, verifyTotp } from '@/lib/auth';
import { calendarToken, digest, getFeishu, saveFeishu, sendFeishu, type FeishuConfig } from '@/lib/notify';
import { deleteSetting, getSetting, setSetting } from '@/lib/settings';
import type { Result } from './actions';
import { log } from '@/lib/activity';

export async function changePassword(current: string, next: string): Promise<Result> {
  await requireAuth();
  if (!verifyPassword(current, getSetting('password_hash'))) return { ok: false, error: '当前密码不正确' };
  if (next.length < 8) return { ok: false, error: '新密码至少 8 位' };
  setSetting('password_hash', hashPassword(next));
  setSetting('password_changed', new Date().toISOString());
  await revokeOtherSessions();
  log('修改密码');
  revalidatePath('/settings');
  return { ok: true };
}

export async function startTotp(): Promise<Result & { secret?: string; qr?: string }> {
  await requireAuth();
  const secret = newTotpSecret();
  const qr = await QRCode.toDataURL(totpUri(secret), { margin: 1, width: 180 });
  return { ok: true, secret, qr };
}

export async function enableTotp(secret: string, code: string): Promise<Result> {
  await requireAuth();
  if (!/^[A-Z2-7]{16,}$/.test(secret) || !verifyTotp(code, secret)) return { ok: false, error: '验证码不正确，请确认手机时间准确后重试' };
  setSetting('totp_secret', secret);
  log('开启两步验证');
  revalidatePath('/settings');
  return { ok: true };
}

export async function disableTotp(code: string): Promise<Result> {
  await requireAuth();
  const secret = totpSecret();
  if (secret && !verifyTotp(code, secret)) return { ok: false, error: '验证码不正确' };
  deleteSetting('totp_secret');
  log('关闭两步验证');
  revalidatePath('/settings');
  return { ok: true };
}

export async function logoutOthers(): Promise<Result> {
  await requireAuth();
  await revokeOtherSessions();
  log('退出其他设备');
  return { ok: true };
}

export async function resetCalendarToken(): Promise<Result & { token?: string }> {
  await requireAuth();
  const token = calendarToken(true);
  revalidatePath('/settings');
  return { ok: true, token };
}

export async function saveFeishuConfig(c: FeishuConfig): Promise<Result> {
  await requireAuth();
  if (c.webhook && !/^https:\/\/open\.(feishu\.cn|larksuite\.com)\/open-apis\/bot\/v2\/hook\/[\w-]+$/.test(c.webhook.trim())) return { ok: false, error: 'Webhook 地址应以 https://open.feishu.cn/open-apis/bot/v2/hook/ 开头' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.time)) return { ok: false, error: '推送时间格式不正确' };
  if (c.appUrl && !/^https?:\/\//.test(c.appUrl)) return { ok: false, error: '访问地址应以 http:// 或 https:// 开头' };
  const old = getFeishu();
  saveFeishu({
    enabled: !!c.enabled, webhook: c.webhook.trim(), secret: c.secret === '••••••' ? old.secret : c.secret.trim(), time: c.time, workdaysOnly: !!c.workdaysOnly, appUrl: c.appUrl.trim(),
    kinds: { due: !!c.kinds.due, trial: !!c.kinds.trial, pay: !!c.kinds.pay, security: !!c.kinds.security },
  });
  revalidatePath('/settings');
  return { ok: true };
}

export async function testFeishu(): Promise<Result> {
  await requireAuth();
  const c = getFeishu();
  if (!c.webhook) return { ok: false, error: '请先填写并保存 Webhook 地址' };
  return sendFeishu(c, digest(c, true)!);
}
