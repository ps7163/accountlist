'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { addCycle, addDays, isValidDate, parseYuan, today, type Cycle } from '@/lib/billing';
import { CATEGORIES, LOGINS, MFAS, NOTE_COLORS, providerOf } from '@/lib/constants';
import { listSubs, notesOf, paymentsOf } from '@/lib/queries';
import { setSetting } from '@/lib/settings';
import { SKINS } from '@/lib/skins';

const { subscriptions, emails, payMethods, payments, notes } = schema;

export interface Result {
  ok: boolean;
  error?: string;
  id?: number;
}

const now = () => new Date().toISOString();
const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);
/** 只允许 http(s) 链接，避免 javascript: 之类的地址被渲染成可点击链接 */
function safeUrl(v: unknown): string {
  const s = str(v, 1000);
  if (!s) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}
function payTypeOf(channel: string): string {
  const map: Record<string, string> = { 'Apple App Store': 'Apple ID', 'Google Play': 'Google Play', PayPal: 'PayPal', 支付宝: '支付宝', 微信支付: '微信支付', '官网 · 信用卡': '信用卡' };
  return map[channel] || '其他';
}
function done(): void {
  revalidatePath('/', 'layout');
}

/* ---------------- 订阅 ---------------- */

export interface SubInput {
  id?: number;
  name: string;
  plan: string;
  category: string;
  emailId: number;
  kind: 'sub' | 'once' | 'free';
  price: string;
  cycle: Cycle;
  date: string;
  trial: boolean;
  autoRenew: boolean;
  status: 'active' | 'cancelled' | 'expired';
  channel: string;
  payMethodId: number | null;
  /** 选择「新建支付方式」时填写的名称 */
  newPayName?: string;
  url: string;
  manageUrl: string;
  login: string;
  mfa: string;
  note: string;
}

export async function saveSubscription(input: SubInput): Promise<Result> {
  await requireAuth();
  const name = str(input.name, 100);
  if (!name) return { ok: false, error: '请填写服务名称' };
  const email = db.select().from(emails).where(eq(emails.id, Number(input.emailId))).get();
  if (!email) return { ok: false, error: '请选择登录邮箱' };
  const kind = (['sub', 'once', 'free'] as const).includes(input.kind) ? input.kind : 'sub';
  const cycle = (['week', 'month', 'quarter', 'year'] as const).includes(input.cycle) ? input.cycle : 'month';
  const date = str(input.date, 10);
  if (kind !== 'free' && !isValidDate(date)) return { ok: false, error: kind === 'once' ? '请填写正确的购买日期' : '请填写正确的扣费日期' };
  const priceCents = kind === 'free' ? 0 : parseYuan(input.price);
  if (kind !== 'free' && priceCents <= 0) return { ok: false, error: '请填写金额' };
  const trial = kind === 'sub' && !!input.trial;
  let payMethodId = kind !== 'free' && input.payMethodId ? Number(input.payMethodId) : null;
  if (payMethodId && !db.select().from(payMethods).where(eq(payMethods.id, payMethodId)).get()) return { ok: false, error: '支付方式不存在' };
  const newPayName = kind !== 'free' ? str(input.newPayName, 80) : '';
  if (!payMethodId && newPayName) {
    const existing = db.select().from(payMethods).where(eq(payMethods.name, newPayName)).get();
    payMethodId = existing ? existing.id : db.insert(payMethods).values({ name: newPayName, type: payTypeOf(str(input.channel, 40)) }).returning({ id: payMethods.id }).get().id;
  }

  const values = {
    name,
    plan: str(input.plan, 60),
    category: CATEGORIES.includes(input.category) ? input.category : '其他',
    emailId: email.id,
    kind,
    priceCents,
    cycle,
    anchorDay: kind === 'sub' ? Number(date.slice(8, 10)) : null,
    nextDate: kind === 'free' ? null : date,
    trialEnd: trial ? date : null,
    autoRenew: kind === 'sub' && !!input.autoRenew,
    status: kind === 'sub' && ['active', 'cancelled', 'expired'].includes(input.status) ? input.status : 'active',
    channel: kind === 'free' ? '' : str(input.channel, 40),
    payMethodId,
    url: safeUrl(input.url),
    manageUrl: safeUrl(input.manageUrl),
    login: input.login in LOGINS ? input.login : 'password',
    mfa: input.mfa in MFAS ? input.mfa : 'none',
    note: str(input.note, 2000),
    updatedAt: now(),
  };

  if (input.id) {
    const exists = db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.id, Number(input.id))).get();
    if (!exists) return { ok: false, error: '订阅不存在' };
    db.update(subscriptions).set(values).where(eq(subscriptions.id, exists.id)).run();
    done();
    return { ok: true, id: exists.id };
  }
  const id = db.transaction((tx) => {
    const row = tx.insert(subscriptions).values(values).returning({ id: subscriptions.id }).get();
    if (kind === 'once') tx.insert(payments).values({ subscriptionId: row.id, date, amountCents: priceCents, note: '一次性购买' }).run();
    return row.id;
  });
  done();
  return { ok: true, id };
}

export async function deleteSubscription(id: number): Promise<Result> {
  await requireAuth();
  db.transaction((tx) => {
    tx.delete(notes).where(and(eq(notes.targetType, 'sub'), eq(notes.targetId, id))).run();
    tx.delete(subscriptions).where(eq(subscriptions.id, id)).run();
  });
  done();
  return { ok: true };
}

function getSub(id: number) {
  return db.select().from(subscriptions).where(eq(subscriptions.id, Number(id))).get();
}

/** 标记已续费：按今天记一笔付费，并把下次扣费日顺延一个周期（已过期的从今天重新计算周期） */
export async function markRenewed(id: number): Promise<Result & { nextDate?: string }> {
  await requireAuth();
  const s = getSub(id);
  if (!s || s.kind !== 'sub' || !s.nextDate) return { ok: false, error: '这个订阅不能续费' };
  const t = today();
  const base = s.nextDate < t ? t : s.nextDate;
  const nextDate = addCycle(base, s.cycle, 1, s.nextDate < t ? Number(t.slice(8, 10)) : s.anchorDay);
  db.transaction((tx) => {
    tx.insert(payments).values({ subscriptionId: s.id, date: t, amountCents: s.priceCents, note: '手动续费' }).run();
    tx.update(subscriptions)
      .set({ nextDate, anchorDay: s.nextDate! < t ? Number(t.slice(8, 10)) : s.anchorDay, status: 'active', snoozeUntil: null, updatedAt: now() })
      .where(eq(subscriptions.id, s.id))
      .run();
  });
  done();
  return { ok: true, nextDate };
}

/** 标记已取消：保留到期日，到期后不再提醒 */
export async function cancelSubscription(id: number): Promise<Result> {
  await requireAuth();
  const s = getSub(id);
  if (!s) return { ok: false, error: '订阅不存在' };
  db.update(subscriptions)
    .set({ status: 'cancelled', autoRenew: false, nextDate: s.trialEnd ?? s.nextDate, trialEnd: null, snoozeUntil: null, updatedAt: now() })
    .where(eq(subscriptions.id, s.id))
    .run();
  done();
  return { ok: true };
}

/** 试用转正式：试用结束日即首次扣费日 */
export async function convertTrial(id: number): Promise<Result> {
  await requireAuth();
  const s = getSub(id);
  if (!s || !s.trialEnd) return { ok: false, error: '这个订阅不在试用中' };
  db.update(subscriptions).set({ nextDate: s.trialEnd, trialEnd: null, autoRenew: true, snoozeUntil: null, updatedAt: now() }).where(eq(subscriptions.id, s.id)).run();
  done();
  return { ok: true };
}

export async function snoozeSubscription(id: number, days: number): Promise<Result & { until?: string }> {
  await requireAuth();
  const n = Math.min(30, Math.max(1, Math.round(Number(days)) || 1));
  const until = addDays(today(), n);
  db.update(subscriptions).set({ snoozeUntil: until }).where(eq(subscriptions.id, Number(id))).run();
  done();
  return { ok: true, until };
}

export async function clearSnoozes(): Promise<Result> {
  await requireAuth();
  db.update(subscriptions).set({ snoozeUntil: null }).run();
  done();
  return { ok: true };
}

export async function getSubDetail(id: number) {
  await requireAuth();
  const sub = listSubs().find((s) => s.id === Number(id));
  if (!sub) return null;
  const email = db.select().from(emails).where(eq(emails.id, sub.emailId)).get()!;
  return { sub, email, payments: paymentsOf(sub.id), notes: notesOf('sub', sub.id) };
}

export async function addPayment(subId: number, date: string, price: string): Promise<Result> {
  await requireAuth();
  if (!getSub(subId)) return { ok: false, error: '订阅不存在' };
  if (!isValidDate(date)) return { ok: false, error: '日期不正确' };
  const amountCents = parseYuan(price);
  if (amountCents <= 0) return { ok: false, error: '请填写金额' };
  db.insert(payments).values({ subscriptionId: Number(subId), date, amountCents, note: '手动添加' }).run();
  done();
  return { ok: true };
}

export async function deletePayment(id: number): Promise<Result> {
  await requireAuth();
  db.delete(payments).where(eq(payments.id, Number(id))).run();
  done();
  return { ok: true };
}

/* ---------------- 邮箱 ---------------- */

export interface EmailInput {
  id?: number;
  address: string;
  phone: string;
  recovery: string;
  note: string;
}

export async function saveEmail(input: EmailInput): Promise<Result> {
  await requireAuth();
  const address = str(input.address, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { ok: false, error: '邮箱地址格式不正确' };
  const recovery = str(input.recovery, 200).toLowerCase();
  if (recovery && recovery === address) return { ok: false, error: '辅助邮箱不能是它自己' };
  const dup = db.select({ id: emails.id }).from(emails).where(eq(emails.address, address)).get();
  if (dup && dup.id !== Number(input.id)) return { ok: false, error: '这个邮箱已经添加过了' };
  const values = { address, provider: providerOf(address), phone: str(input.phone, 40), recovery, note: str(input.note, 300), updatedAt: now() };
  if (input.id) {
    db.update(emails).set(values).where(eq(emails.id, Number(input.id))).run();
    done();
    return { ok: true, id: Number(input.id) };
  }
  const row = db.insert(emails).values(values).returning({ id: emails.id }).get();
  done();
  return { ok: true, id: row.id };
}

export async function deleteEmail(id: number): Promise<Result> {
  await requireAuth();
  const used = db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.emailId, Number(id))).all();
  if (used.length) return { ok: false, error: `还有 ${used.length} 个服务使用这个邮箱，请先删除或改到其他邮箱` };
  db.transaction((tx) => {
    tx.delete(notes).where(and(eq(notes.targetType, 'email'), eq(notes.targetId, Number(id)))).run();
    tx.delete(emails).where(eq(emails.id, Number(id))).run();
  });
  done();
  return { ok: true };
}

/* ---------------- 支付方式 ---------------- */

export interface PayInput {
  id?: number;
  name: string;
  type: string;
  expireMonth: string;
  note: string;
}

export async function savePayMethod(input: PayInput): Promise<Result> {
  await requireAuth();
  const name = str(input.name, 80);
  if (!name) return { ok: false, error: '请填写名称，如「招行信用卡 尾号 1234」' };
  const expireMonth = str(input.expireMonth, 7);
  if (expireMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(expireMonth)) return { ok: false, error: '有效期格式应为 YYYY-MM' };
  const values = { name, type: str(input.type, 30) || '其他', expireMonth: expireMonth || null, note: str(input.note, 300), updatedAt: now() };
  if (input.id) {
    db.update(payMethods).set(values).where(eq(payMethods.id, Number(input.id))).run();
    done();
    return { ok: true, id: Number(input.id) };
  }
  const row = db.insert(payMethods).values(values).returning({ id: payMethods.id }).get();
  done();
  return { ok: true, id: row.id };
}

export async function deletePayMethod(id: number): Promise<Result> {
  await requireAuth();
  db.delete(payMethods).where(eq(payMethods.id, Number(id))).run();
  done();
  return { ok: true };
}

/* ---------------- 备注卡片 ---------------- */

export interface NoteInput {
  id?: number;
  targetType: 'email' | 'sub';
  targetId: number;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
}

export async function saveNote(input: NoteInput): Promise<Result> {
  await requireAuth();
  const title = str(input.title, 100);
  if (!title) return { ok: false, error: '请填写标题' };
  const targetType = input.targetType === 'email' ? 'email' : 'sub';
  const table = targetType === 'email' ? emails : subscriptions;
  if (!db.select({ id: table.id }).from(table).where(eq(table.id, Number(input.targetId))).get()) return { ok: false, error: '关联的账号不存在' };
  const values = {
    targetType,
    targetId: Number(input.targetId),
    title,
    body: str(input.body, 5000),
    color: NOTE_COLORS.some(([c]) => c === input.color) ? input.color : 'yellow',
    pinned: !!input.pinned,
    updatedAt: now(),
  } as const;
  if (input.id) {
    db.update(notes).set(values).where(eq(notes.id, Number(input.id))).run();
    done();
    return { ok: true, id: Number(input.id) };
  }
  const row = db.insert(notes).values(values).returning({ id: notes.id }).get();
  done();
  return { ok: true, id: row.id };
}

export async function deleteNote(id: number): Promise<Result> {
  await requireAuth();
  db.delete(notes).where(eq(notes.id, Number(id))).run();
  done();
  return { ok: true };
}

/* ---------------- 偏好 ---------------- */

export async function savePrefs(input: { remindDays?: number; skin?: string; displayName?: string }): Promise<Result> {
  await requireAuth();
  if (input.remindDays !== undefined) {
    const n = Math.round(Number(input.remindDays));
    if (!(n >= 1 && n <= 60)) return { ok: false, error: '提醒天数需在 1 到 60 之间' };
    setSetting('remind_days', String(n));
  }
  if (input.skin !== undefined && SKINS[input.skin]) setSetting('skin', input.skin);
  if (input.displayName !== undefined) setSetting('display_name', str(input.displayName, 20) || '管理员');
  done();
  return { ok: true };
}

/** 批量操作：续费 / 取消 / 删除 */
export async function batchSubs(ids: number[], op: 'renew' | 'cancel' | 'delete'): Promise<Result & { count?: number }> {
  await requireAuth();
  let count = 0;
  for (const id of ids.slice(0, 500).map(Number)) {
    const r = op === 'renew' ? await markRenewed(id) : op === 'cancel' ? await cancelSubscription(id) : await deleteSubscription(id);
    if (r.ok) count++;
  }
  done();
  return { ok: true, count };
}
