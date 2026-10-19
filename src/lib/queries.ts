import 'server-only';
import { and, asc, desc, eq, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { db, schema } from './db';
import { monthlyCents, rollForward, subState, today, type Cycle, type Kind, type Status, type SubState } from './billing';
import { getPrefs } from './settings';

const { emails, payMethods, subscriptions, payments, notes, priceChanges } = schema;

export interface SubView {
  id: number;
  name: string;
  plan: string;
  category: string;
  emailId: number;
  emailAddress: string;
  emailProvider: string;
  kind: Kind;
  priceCents: number;
  cycle: Cycle;
  anchorDay: number | null;
  nextDate: string | null;
  trialEnd: string | null;
  autoRenew: boolean;
  status: Status;
  channel: string;
  payMethodId: number | null;
  payName: string;
  url: string;
  manageUrl: string;
  login: string;
  mfa: string;
  note: string;
  snoozeUntil: string | null;
  usage: string;
  reviewedAt: string | null;
  /** 最近一次价格变动 */
  lastChange: { date: string; oldCents: number; newCents: number } | null;
  state: SubState;
  monthlyCents: number;
}

/**
 * 自动续费顺延：把已过扣费日、开启自动续费的订阅推到下一期，并补记付费。
 * 每次打开页面都会调用，幂等。
 */
export function syncRenewals(): number {
  const t = today();
  const due = db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.kind, 'sub'),
        eq(subscriptions.status, 'active'),
        eq(subscriptions.autoRenew, true),
        isNull(subscriptions.deletedAt),
        or(lt(subscriptions.nextDate, t), and(isNotNull(subscriptions.trialEnd), lt(subscriptions.trialEnd, t))),
      ),
    )
    .all();
  if (!due.length) return 0;
  db.transaction((tx) => {
    for (const s of due) {
      const r = rollForward(s, t);
      if (!r.paidDates.length) continue;
      for (const date of r.paidDates) tx.insert(payments).values({ subscriptionId: s.id, date, amountCents: s.priceCents, auto: true, note: '自动续费' }).run();
      tx.update(subscriptions).set({ nextDate: r.nextDate, trialEnd: r.trialEnd, updatedAt: new Date().toISOString() }).where(eq(subscriptions.id, s.id)).run();
    }
  });
  return due.length;
}

export function listSubs(): SubView[] {
  const t = today();
  const { remindDays } = getPrefs();
  const rows = db
    .select({ s: subscriptions, emailAddress: emails.address, emailProvider: emails.provider, payName: payMethods.name })
    .from(subscriptions)
    .innerJoin(emails, eq(subscriptions.emailId, emails.id))
    .leftJoin(payMethods, and(eq(subscriptions.payMethodId, payMethods.id), isNull(payMethods.deletedAt)))
    .where(isNull(subscriptions.deletedAt))
    .orderBy(asc(subscriptions.name))
    .all();
  const changes = new Map<number, { date: string; oldCents: number; newCents: number }>();
  for (const c of db.select().from(priceChanges).orderBy(asc(priceChanges.date), asc(priceChanges.id)).all()) changes.set(c.subscriptionId, c);
  return rows.map(({ s, emailAddress, emailProvider, payName }) => ({
    id: s.id,
    name: s.name,
    plan: s.plan,
    category: s.category,
    emailId: s.emailId,
    emailAddress,
    emailProvider,
    kind: s.kind,
    priceCents: s.priceCents,
    cycle: s.cycle,
    anchorDay: s.anchorDay,
    nextDate: s.nextDate,
    trialEnd: s.trialEnd,
    autoRenew: s.autoRenew,
    status: s.status,
    channel: s.channel,
    payMethodId: payName ? s.payMethodId : null,
    payName: payName ?? '',
    url: s.url,
    manageUrl: s.manageUrl,
    login: s.login,
    mfa: s.mfa,
    note: s.note,
    snoozeUntil: s.snoozeUntil,
    usage: s.usage,
    reviewedAt: s.reviewedAt,
    lastChange: changes.get(s.id) ?? null,
    state: subState(s, t, remindDays),
    monthlyCents: monthlyCents(s),
  }));
}

export const listEmails = () => db.select().from(emails).where(isNull(emails.deletedAt)).orderBy(asc(emails.id)).all();
export const listPayMethods = () => db.select().from(payMethods).where(isNull(payMethods.deletedAt)).orderBy(asc(payMethods.id)).all();
export const listNotes = () => db.select().from(notes).where(isNull(notes.deletedAt)).orderBy(desc(notes.pinned), desc(notes.updatedAt)).all();

export interface PaymentView {
  id: number;
  subscriptionId: number;
  date: string;
  amountCents: number;
  auto: boolean;
  note: string;
  name: string;
  plan: string;
  emailAddress: string;
  channel: string;
  payName: string;
}

export function listPayments(): PaymentView[] {
  return db
    .select({
      id: payments.id,
      subscriptionId: payments.subscriptionId,
      date: payments.date,
      amountCents: payments.amountCents,
      auto: payments.auto,
      note: payments.note,
      name: subscriptions.name,
      plan: subscriptions.plan,
      emailAddress: emails.address,
      channel: subscriptions.channel,
      payName: payMethods.name,
    })
    .from(payments)
    .innerJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
    .innerJoin(emails, eq(subscriptions.emailId, emails.id))
    .leftJoin(payMethods, and(eq(subscriptions.payMethodId, payMethods.id), isNull(payMethods.deletedAt)))
    .where(isNull(subscriptions.deletedAt))
    .orderBy(desc(payments.date), desc(payments.id))
    .all()
    .map((r) => ({ ...r, payName: r.payName ?? '' }));
}

export function paymentsOf(subId: number) {
  return db.select().from(payments).where(eq(payments.subscriptionId, subId)).orderBy(desc(payments.date), desc(payments.id)).all();
}

export function notesOf(type: 'email' | 'sub', id: number) {
  return db.select().from(notes).where(and(eq(notes.targetType, type), eq(notes.targetId, id), isNull(notes.deletedAt))).orderBy(desc(notes.pinned), desc(notes.updatedAt)).all();
}

/** 支付方式 60 天内到期 */
export function expiringPayMethods(list = listPayMethods(), t = today()) {
  return list.filter((p) => {
    if (!p.expireMonth) return false;
    const [y, m] = p.expireMonth.split('-').map(Number);
    const end = new Date(Date.UTC(y, m, 0));
    const now = new Date(t + 'T00:00:00Z');
    return (end.getTime() - now.getTime()) / 86400000 <= 60;
  });
}

export function priceChangesOf(subId: number) {
  return db.select().from(priceChanges).where(eq(priceChanges.subscriptionId, subId)).orderBy(desc(priceChanges.date), desc(priceChanges.id)).all();
}
