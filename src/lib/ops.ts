import 'server-only';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { log } from '@/lib/activity';
import { addCycle, addDays, formatYuan, isValidDate, parseYuan, today, type Cycle } from '@/lib/billing';
import { CATEGORIES, LOGINS, MFAS, NOTE_COLORS, USAGES, providerOf } from '@/lib/constants';
import { listSubs, notesOf, paymentsOf, priceChangesOf } from '@/lib/queries';
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

const liveSub = (id: number) => db.select().from(subscriptions).where(and(eq(subscriptions.id, Number(id)), isNull(subscriptions.deletedAt))).get();
const liveEmail = (id: number) => db.select().from(emails).where(and(eq(emails.id, Number(id)), isNull(emails.deletedAt))).get();
const livePay = (id: number) => db.select().from(payMethods).where(and(eq(payMethods.id, Number(id)), isNull(payMethods.deletedAt))).get();
const subLabel = (s: { name: string; plan: string }) => `${s.name} ${s.plan}`.trim();

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
  usage: string;
  note: string;
}

export async function saveSubscription(input: SubInput): Promise<Result> {
  const name = str(input.name, 100);
  if (!name) return { ok: false, error: '请填写服务名称' };
  const email = liveEmail(input.emailId);
  if (!email) return { ok: false, error: '请选择登录邮箱' };
  const kind = (['sub', 'once', 'free'] as const).includes(input.kind) ? input.kind : 'sub';
  const cycle = (['week', 'month', 'quarter', 'year'] as const).includes(input.cycle) ? input.cycle : 'month';
  const date = str(input.date, 10);
  if (kind !== 'free' && !isValidDate(date)) return { ok: false, error: kind === 'once' ? '请填写正确的购买日期' : '请填写正确的扣费日期' };
  const priceCents = kind === 'free' ? 0 : parseYuan(input.price);
  if (kind !== 'free' && priceCents <= 0) return { ok: false, error: '请填写金额' };
  const trial = kind === 'sub' && !!input.trial;
  let payMethodId = kind !== 'free' && input.payMethodId ? Number(input.payMethodId) : null;
  if (payMethodId && !livePay(payMethodId)) return { ok: false, error: '支付方式不存在' };
  const newPayName = kind !== 'free' ? str(input.newPayName, 80) : '';
  if (!payMethodId && newPayName) {
    const existing = db.select().from(payMethods).where(and(eq(payMethods.name, newPayName), isNull(payMethods.deletedAt))).get();
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
    usage: input.usage in USAGES ? input.usage : '',
    note: str(input.note, 2000),
    updatedAt: now(),
  };

  if (input.id) {
    const old = liveSub(input.id);
    if (!old) return { ok: false, error: '订阅不存在' };
    db.transaction((tx) => {
      // 价格变动：同一计费方式和周期下金额变化才记录
      if (old.kind !== 'free' && kind === old.kind && cycle === old.cycle && old.priceCents !== priceCents) {
        tx.insert(schema.priceChanges).values({ subscriptionId: old.id, date: today(), oldCents: old.priceCents, newCents: priceCents }).run();
      }
      tx.update(subscriptions).set(values).where(eq(subscriptions.id, old.id)).run();
    });
    log('编辑订阅', subLabel(values), old.priceCents !== priceCents ? `价格 ${formatYuan(old.priceCents)} → ${formatYuan(priceCents)}` : '');
    done();
    return { ok: true, id: old.id };
  }
  const id = db.transaction((tx) => {
    const row = tx.insert(subscriptions).values(values).returning({ id: subscriptions.id }).get();
    if (kind === 'once') tx.insert(payments).values({ subscriptionId: row.id, date, amountCents: priceCents, note: '一次性购买' }).run();
    return row.id;
  });
  log('新建订阅', subLabel(values), email.address);
  done();
  return { ok: true, id };
}

/** 删除订阅：移入回收站，连同它的备注卡片 */
export async function deleteSubscription(id: number): Promise<Result> {
  const s = liveSub(id);
  if (!s) return { ok: false, error: '订阅不存在' };
  const at = now();
  db.transaction((tx) => {
    tx.update(notes).set({ deletedAt: at }).where(and(eq(notes.targetType, 'sub'), eq(notes.targetId, s.id), isNull(notes.deletedAt))).run();
    tx.update(subscriptions).set({ deletedAt: at }).where(eq(subscriptions.id, s.id)).run();
  });
  log('删除订阅', subLabel(s), '已移入回收站');
  done();
  return { ok: true };
}

/** 标记已续费：按今天记一笔付费，并把下次扣费日顺延一个周期（已过期的从今天重新计算周期） */
export async function markRenewed(id: number): Promise<Result & { nextDate?: string }> {
  const s = liveSub(id);
  if (!s || s.kind !== 'sub' || !s.nextDate) return { ok: false, error: '这个订阅不能续费' };
  const t = today();
  const late = s.nextDate < t;
  const anchor = late ? Number(t.slice(8, 10)) : s.anchorDay;
  const nextDate = addCycle(late ? t : s.nextDate, s.cycle, 1, anchor);
  db.transaction((tx) => {
    tx.insert(payments).values({ subscriptionId: s.id, date: t, amountCents: s.priceCents, note: '手动续费' }).run();
    tx.update(subscriptions).set({ nextDate, anchorDay: anchor, status: 'active', snoozeUntil: null, updatedAt: now() }).where(eq(subscriptions.id, s.id)).run();
  });
  log('标记已续费', subLabel(s), `${formatYuan(s.priceCents)}，下次 ${nextDate}`);
  done();
  return { ok: true, nextDate };
}

/** 标记已取消：保留到期日，到期后不再提醒 */
export async function cancelSubscription(id: number): Promise<Result> {
  const s = liveSub(id);
  if (!s) return { ok: false, error: '订阅不存在' };
  db.update(subscriptions)
    .set({ status: 'cancelled', autoRenew: false, nextDate: s.trialEnd ?? s.nextDate, trialEnd: null, snoozeUntil: null, updatedAt: now() })
    .where(eq(subscriptions.id, s.id))
    .run();
  log('取消订阅', subLabel(s));
  done();
  return { ok: true };
}

/** 试用转正式：试用结束日即首次扣费日 */
export async function convertTrial(id: number): Promise<Result> {
  const s = liveSub(id);
  if (!s || !s.trialEnd) return { ok: false, error: '这个订阅不在试用中' };
  db.update(subscriptions).set({ nextDate: s.trialEnd, trialEnd: null, autoRenew: true, snoozeUntil: null, updatedAt: now() }).where(eq(subscriptions.id, s.id)).run();
  log('试用转正式', subLabel(s), `首次扣费 ${s.trialEnd}`);
  done();
  return { ok: true };
}

export async function snoozeSubscription(id: number, days: number): Promise<Result & { until?: string }> {
  const s = liveSub(id);
  if (!s) return { ok: false, error: '订阅不存在' };
  const n = Math.min(30, Math.max(1, Math.round(Number(days)) || 1));
  const until = addDays(today(), n);
  db.update(subscriptions).set({ snoozeUntil: until }).where(eq(subscriptions.id, s.id)).run();
  log('稍后提醒', subLabel(s), `${until} 再提醒`);
  done();
  return { ok: true, until };
}

export async function clearSnoozes(): Promise<Result> {
  db.update(subscriptions).set({ snoozeUntil: null }).run();
  done();
  return { ok: true };
}

export async function getSubDetail(id: number) {
  const sub = listSubs().find((s) => s.id === Number(id));
  if (!sub) return null;
  const email = db.select().from(emails).where(eq(emails.id, sub.emailId)).get()!;
  return { sub, email, payments: paymentsOf(sub.id), notes: notesOf('sub', sub.id), priceChanges: priceChangesOf(sub.id) };
}

export async function addPayment(subId: number, date: string, price: string): Promise<Result> {
  const s = liveSub(subId);
  if (!s) return { ok: false, error: '订阅不存在' };
  if (!isValidDate(date)) return { ok: false, error: '日期不正确' };
  const amountCents = parseYuan(price);
  if (amountCents <= 0) return { ok: false, error: '请填写金额' };
  db.insert(payments).values({ subscriptionId: s.id, date, amountCents, note: '手动添加' }).run();
  log('补记付费', subLabel(s), `${date} ${formatYuan(amountCents)}`);
  done();
  return { ok: true };
}

export async function deletePayment(id: number): Promise<Result> {
  const p = db.select().from(payments).where(eq(payments.id, Number(id))).get();
  if (!p) return { ok: false, error: '记录不存在' };
  db.delete(payments).where(eq(payments.id, p.id)).run();
  const s = db.select().from(subscriptions).where(eq(subscriptions.id, p.subscriptionId)).get();
  log('删除付费记录', s ? subLabel(s) : '', `${p.date} ${formatYuan(p.amountCents)}`);
  done();
  return { ok: true };
}

/** 设置使用频率（订阅体检里快速标记） */
export async function setUsage(id: number, usage: string): Promise<Result> {
  const s = liveSub(id);
  if (!s || !(usage in USAGES)) return { ok: false, error: '参数不正确' };
  db.update(subscriptions).set({ usage, updatedAt: now() }).where(eq(subscriptions.id, s.id)).run();
  done();
  return { ok: true };
}

/** 体检时确认保留：90 天内不再出现在体检建议里 */
export async function keepSubscription(id: number): Promise<Result> {
  const s = liveSub(id);
  if (!s) return { ok: false, error: '订阅不存在' };
  db.update(subscriptions).set({ reviewedAt: today() }).where(eq(subscriptions.id, s.id)).run();
  log('体检确认保留', subLabel(s));
  done();
  return { ok: true };
}

export async function finishReview(): Promise<Result> {
  setSetting('last_review', today());
  log('完成订阅体检');
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
  const address = str(input.address, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { ok: false, error: '邮箱地址格式不正确' };
  const recovery = str(input.recovery, 200).toLowerCase();
  if (recovery && recovery === address) return { ok: false, error: '辅助邮箱不能是它自己' };
  const dups = db.select({ id: emails.id, deletedAt: emails.deletedAt }).from(emails).where(eq(emails.address, address)).all().filter((d) => d.id !== Number(input.id));
  if (dups.some((d) => !d.deletedAt)) return { ok: false, error: '这个邮箱已经添加过了' };
  if (dups.length) return { ok: false, error: '回收站里有这个邮箱，可以到「回收站」恢复' };
  const values = { address, provider: providerOf(address), phone: str(input.phone, 40), recovery, note: str(input.note, 300), updatedAt: now() };
  if (input.id) {
    if (!liveEmail(input.id)) return { ok: false, error: '邮箱不存在' };
    db.update(emails).set(values).where(eq(emails.id, Number(input.id))).run();
    log('编辑邮箱', address);
    done();
    return { ok: true, id: Number(input.id) };
  }
  const row = db.insert(emails).values(values).returning({ id: emails.id }).get();
  log('添加邮箱', address);
  done();
  return { ok: true, id: row.id };
}

export async function deleteEmail(id: number): Promise<Result> {
  const e = liveEmail(id);
  if (!e) return { ok: false, error: '邮箱不存在' };
  const used = db.select({ id: subscriptions.id }).from(subscriptions).where(and(eq(subscriptions.emailId, e.id), isNull(subscriptions.deletedAt))).all();
  if (used.length) return { ok: false, error: `还有 ${used.length} 个服务使用这个邮箱，请先删除或改到其他邮箱` };
  const at = now();
  db.transaction((tx) => {
    tx.update(notes).set({ deletedAt: at }).where(and(eq(notes.targetType, 'email'), eq(notes.targetId, e.id), isNull(notes.deletedAt))).run();
    tx.update(emails).set({ deletedAt: at }).where(eq(emails.id, e.id)).run();
  });
  log('删除邮箱', e.address, '已移入回收站');
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
  const name = str(input.name, 80);
  if (!name) return { ok: false, error: '请填写名称，如「招行信用卡 尾号 1234」' };
  const expireMonth = str(input.expireMonth, 7);
  if (expireMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(expireMonth)) return { ok: false, error: '有效期格式应为 YYYY-MM' };
  const values = { name, type: str(input.type, 30) || '其他', expireMonth: expireMonth || null, note: str(input.note, 300), updatedAt: now() };
  if (input.id) {
    if (!livePay(input.id)) return { ok: false, error: '支付方式不存在' };
    db.update(payMethods).set(values).where(eq(payMethods.id, Number(input.id))).run();
    log('编辑支付方式', name);
    done();
    return { ok: true, id: Number(input.id) };
  }
  const row = db.insert(payMethods).values(values).returning({ id: payMethods.id }).get();
  log('添加支付方式', name);
  done();
  return { ok: true, id: row.id };
}

export async function deletePayMethod(id: number): Promise<Result> {
  const p = livePay(id);
  if (!p) return { ok: false, error: '支付方式不存在' };
  db.update(payMethods).set({ deletedAt: now() }).where(eq(payMethods.id, p.id)).run();
  log('删除支付方式', p.name, '已移入回收站');
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
  const title = str(input.title, 100);
  if (!title) return { ok: false, error: '请填写标题' };
  const targetType = input.targetType === 'email' ? 'email' : 'sub';
  if (!(targetType === 'email' ? liveEmail(input.targetId) : liveSub(input.targetId))) return { ok: false, error: '关联的账号不存在' };
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
    db.update(notes).set(values).where(and(eq(notes.id, Number(input.id)), isNull(notes.deletedAt))).run();
    log('编辑卡片', title);
    done();
    return { ok: true, id: Number(input.id) };
  }
  const row = db.insert(notes).values(values).returning({ id: notes.id }).get();
  log('新建卡片', title);
  done();
  return { ok: true, id: row.id };
}

export async function deleteNote(id: number): Promise<Result> {
  const n = db.select().from(notes).where(and(eq(notes.id, Number(id)), isNull(notes.deletedAt))).get();
  if (!n) return { ok: false, error: '卡片不存在' };
  db.update(notes).set({ deletedAt: now() }).where(eq(notes.id, n.id)).run();
  log('删除卡片', n.title, '已移入回收站');
  done();
  return { ok: true };
}

/* ---------------- 回收站 ---------------- */

export type TrashType = 'sub' | 'email' | 'pay' | 'note';

export async function restoreItem(type: TrashType, id: number): Promise<Result> {
  const n = Number(id);
  if (type === 'sub') {
    const s = db.select().from(subscriptions).where(eq(subscriptions.id, n)).get();
    if (!s?.deletedAt) return { ok: false, error: '回收站里没有这一项' };
    const e = db.select().from(emails).where(eq(emails.id, s.emailId)).get();
    if (e?.deletedAt && db.select({ id: emails.id }).from(emails).where(and(eq(emails.address, e.address), isNull(emails.deletedAt))).get()) {
      return { ok: false, error: `它的登录邮箱 ${e.address} 已被重新添加，请先把订阅改到新邮箱后再恢复` };
    }
    db.transaction((tx) => {
      if (e?.deletedAt) tx.update(emails).set({ deletedAt: null }).where(eq(emails.id, e.id)).run();
      tx.update(notes).set({ deletedAt: null }).where(and(eq(notes.targetType, 'sub'), eq(notes.targetId, s.id), eq(notes.deletedAt, s.deletedAt!))).run();
      tx.update(subscriptions).set({ deletedAt: null }).where(eq(subscriptions.id, s.id)).run();
    });
    log('恢复订阅', subLabel(s), e?.deletedAt ? `同时恢复邮箱 ${e.address}` : '');
  } else if (type === 'email') {
    const e = db.select().from(emails).where(eq(emails.id, n)).get();
    if (!e?.deletedAt) return { ok: false, error: '回收站里没有这一项' };
    if (db.select({ id: emails.id }).from(emails).where(and(eq(emails.address, e.address), isNull(emails.deletedAt))).get()) return { ok: false, error: '已经有同名邮箱了' };
    db.transaction((tx) => {
      tx.update(notes).set({ deletedAt: null }).where(and(eq(notes.targetType, 'email'), eq(notes.targetId, e.id), eq(notes.deletedAt, e.deletedAt!))).run();
      tx.update(emails).set({ deletedAt: null }).where(eq(emails.id, e.id)).run();
    });
    log('恢复邮箱', e.address);
  } else if (type === 'pay') {
    const p = db.select().from(payMethods).where(eq(payMethods.id, n)).get();
    if (!p?.deletedAt) return { ok: false, error: '回收站里没有这一项' };
    db.update(payMethods).set({ deletedAt: null }).where(eq(payMethods.id, p.id)).run();
    log('恢复支付方式', p.name);
  } else {
    const x = db.select().from(notes).where(eq(notes.id, n)).get();
    if (!x?.deletedAt) return { ok: false, error: '回收站里没有这一项' };
    const target = x.targetType === 'email' ? liveEmail(x.targetId) : liveSub(x.targetId);
    if (!target) return { ok: false, error: '它关联的账号还在回收站里，请先恢复账号' };
    db.update(notes).set({ deletedAt: null }).where(eq(notes.id, x.id)).run();
    log('恢复卡片', x.title);
  }
  done();
  return { ok: true };
}

export async function purgeItem(type: TrashType, id: number): Promise<Result> {
  const { purge } = await import('@/lib/trash');
  const r = purge(type, Number(id));
  if (r.ok) done();
  return r;
}

export async function emptyTrash(): Promise<Result & { count?: number }> {
  const { purgeOlderThan } = await import('@/lib/trash');
  const count = purgeOlderThan(0);
  log('清空回收站', '', `${count} 项`);
  done();
  return { ok: true, count };
}

/* ---------------- 偏好 ---------------- */

export async function savePrefs(input: { remindDays?: number; skin?: string; displayName?: string; budget?: string }): Promise<Result> {
  if (input.remindDays !== undefined) {
    const n = Math.round(Number(input.remindDays));
    if (!(n >= 1 && n <= 60)) return { ok: false, error: '提醒天数需在 1 到 60 之间' };
    setSetting('remind_days', String(n));
  }
  if (input.skin !== undefined && SKINS[input.skin]) setSetting('skin', input.skin);
  if (input.displayName !== undefined) setSetting('display_name', str(input.displayName, 20) || '管理员');
  if (input.budget !== undefined) {
    const cents = str(input.budget) === '' ? 0 : parseYuan(input.budget);
    setSetting('budget_cents', String(cents));
    log('设置月度预算', '', cents ? formatYuan(cents, 0) : '不设预算');
  }
  done();
  return { ok: true };
}

/** 批量操作：续费 / 取消 / 删除 */
export async function batchSubs(ids: number[], op: 'renew' | 'cancel' | 'delete'): Promise<Result & { count?: number }> {
  let count = 0;
  for (const id of ids.slice(0, 500).map(Number)) {
    const r = op === 'renew' ? await markRenewed(id) : op === 'cancel' ? await cancelSubscription(id) : await deleteSubscription(id);
    if (r.ok) count++;
  }
  done();
  return { ok: true, count };
}
