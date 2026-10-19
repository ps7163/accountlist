/**
 * 计费与日期规则。纯函数，不依赖数据库，便于测试。
 * 日期统一使用 YYYY-MM-DD 字符串；金额统一使用「分」。
 */

export type Cycle = 'week' | 'month' | 'quarter' | 'year';
export type Kind = 'sub' | 'once' | 'free';
export type Status = 'active' | 'cancelled' | 'expired';

export const CYCLE_LABEL: Record<Cycle, string> = { week: '周付', month: '月付', quarter: '季付', year: '年付' };
export const CYCLE_UNIT: Record<Cycle, string> = { week: '周', month: '月', quarter: '季', year: '年' };
const MONTHS: Record<Exclude<Cycle, 'week'>, number> = { month: 1, quarter: 3, year: 12 };
/** 每个周期折合多少个月 */
export const PER_MONTH: Record<Cycle, number> = { week: 52 / 12, month: 1, quarter: 1 / 3, year: 1 / 12 };

export const TIME_ZONE = process.env.TZ_DISPLAY || 'Asia/Shanghai';

/** 按北京时间（或 TZ_DISPLAY）计算的今天 */
export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function parse(d: string): { y: number; m: number; day: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
}
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function isValidDate(d: string | null | undefined): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const { y, m, day } = parse(d);
  return m >= 1 && m <= 12 && day >= 1 && day <= daysInMonth(y, m);
}

export function addDays(d: string, n: number): string {
  const { y, m, day } = parse(d);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** b - a 的天数 */
export function diffDays(a: string, b: string): number {
  const A = parse(a), B = parse(b);
  return Math.round((Date.UTC(B.y, B.m - 1, B.day) - Date.UTC(A.y, A.m - 1, A.day)) / 86400000);
}

export function weekday(d: string): string {
  const { y, m, day } = parse(d);
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
}

/**
 * 顺延 k 个周期。月/季/年按「锚定日」计算：
 * 31 号订阅的月付，遇到小月按月末扣，下个月回到 31 号。
 */
export function addCycle(d: string, cycle: Cycle, k = 1, anchorDay?: number | null): string {
  if (cycle === 'week') return addDays(d, 7 * k);
  const { y, m, day } = parse(d);
  const anchor = anchorDay ?? day;
  const total = y * 12 + (m - 1) + MONTHS[cycle] * k;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  return ymd(ny, nm, Math.min(anchor, daysInMonth(ny, nm)));
}

export interface BillingLike {
  kind: Kind;
  status: Status;
  cycle: Cycle;
  priceCents: number;
  nextDate: string | null;
  trialEnd: string | null;
  autoRenew: boolean;
  anchorDay: number | null;
  snoozeUntil?: string | null;
}

export interface RenewalResult {
  nextDate: string | null;
  trialEnd: string | null;
  /** 需要补记的付费记录（日期） */
  paidDates: string[];
}

/**
 * 自动续费顺延：对开启自动续费且已过扣费日的订阅，
 * 逐期补记付费并把下次扣费日推到今天或之后。
 * 试用到期且开启自动续费的，视为转正并在试用结束日扣第一笔。
 */
export function rollForward(s: BillingLike, todayStr: string, maxPeriods = 520): RenewalResult {
  const res: RenewalResult = { nextDate: s.nextDate, trialEnd: s.trialEnd, paidDates: [] };
  if (s.kind !== 'sub' || s.status !== 'active' || !s.autoRenew) return res;
  if (res.trialEnd) {
    if (res.trialEnd >= todayStr) return res;
    res.paidDates.push(res.trialEnd);
    res.nextDate = addCycle(res.trialEnd, s.cycle, 1, s.anchorDay);
    res.trialEnd = null;
  }
  let guard = 0;
  while (res.nextDate && res.nextDate < todayStr && guard++ < maxPeriods) {
    res.paidDates.push(res.nextDate);
    res.nextDate = addCycle(res.nextDate, s.cycle, 1, s.anchorDay);
  }
  return res;
}

export type Tone = 'green' | 'orange' | 'red' | 'purple' | 'gray' | 'blue';
export type Group = 'active' | 'trial' | 'ended' | 'once' | 'free';
export interface SubState {
  label: string;
  tone: Tone;
  group: Group;
  /** 是否需要出现在待办/提醒里 */
  alert: boolean;
  /** 距离扣费/试用结束的天数 */
  days: number | null;
}

export function subState(s: BillingLike, todayStr: string, remindDays: number): SubState {
  if (s.kind === 'free') return { label: '仅注册', tone: 'gray', group: 'free', alert: false, days: null };
  if (s.kind === 'once') return { label: '已买断', tone: 'gray', group: 'once', alert: false, days: null };
  if (s.status === 'cancelled') return { label: '已取消', tone: 'gray', group: 'ended', alert: false, days: s.nextDate ? diffDays(todayStr, s.nextDate) : null };
  if (s.status === 'expired') return { label: '已过期', tone: 'red', group: 'ended', alert: false, days: null };
  const snoozed = !!s.snoozeUntil && s.snoozeUntil > todayStr;
  if (s.trialEnd) {
    const d = diffDays(todayStr, s.trialEnd);
    if (d < 0) return { label: '试用已结束', tone: 'red', group: 'trial', alert: !snoozed, days: d };
    return { label: `试用中 · 剩 ${d} 天`, tone: d <= remindDays ? 'orange' : 'purple', group: 'trial', alert: d <= remindDays && !snoozed, days: d };
  }
  if (!s.nextDate) return { label: '使用中', tone: 'green', group: 'active', alert: false, days: null };
  const d = diffDays(todayStr, s.nextDate);
  if (d < 0) return { label: `已过期 ${-d} 天`, tone: 'red', group: 'active', alert: !snoozed, days: d };
  if (d <= remindDays) return { label: d === 0 ? '今天到期' : `${d} 天后到期`, tone: 'orange', group: 'active', alert: !snoozed, days: d };
  return { label: '使用中', tone: 'green', group: 'active', alert: false, days: d };
}

/** 每月折合金额（分）。试用中、已取消、买断、免费不计入 */
export function monthlyCents(s: BillingLike): number {
  if (s.kind !== 'sub' || s.status !== 'active' || s.trialEnd) return 0;
  return s.priceCents * PER_MONTH[s.cycle];
}

/** 列出某个区间内预计的扣费日（含首尾），用于日历 */
export function projectedDates(s: BillingLike, from: string, to: string, todayStr: string): string[] {
  if (s.kind !== 'sub' || s.status !== 'active') return [];
  const out: string[] = [];
  let d = s.trialEnd ?? s.nextDate;
  let guard = 0;
  while (d && d <= to && guard++ < 400) {
    if (d >= from && d >= todayStr) out.push(d);
    if (!s.autoRenew && !s.trialEnd) break;
    d = addCycle(d, s.cycle, 1, s.anchorDay);
  }
  return out;
}

export function formatYuan(cents: number, digits = 2): string {
  return '¥' + (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function parseYuan(v: string): number {
  const n = Number(String(v).replace(/[¥,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}
