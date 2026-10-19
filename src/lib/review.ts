import 'server-only';
import { addDays, diffDays, today } from './billing';
import type { SubView } from './queries';

/** 体检建议在确认「保留」后 90 天内不再出现 */
const KEEP_DAYS = 90;
const OVERLAP_CATS = ['AI', '影音', '存储', '开发工具', '设计'];

export interface Review {
  /** 花得多、用得少 */
  waste: SubView[];
  /** 付费但还没标记使用频率 */
  unmarked: SubView[];
  /** 同类订阅（同一分类多个在付费） */
  overlaps: { category: string; subs: SubView[]; monthlyCents: number }[];
  /** 同一个服务在多个邮箱下都在付费 */
  duplicates: { name: string; subs: SubView[] }[];
  /** 近 180 天涨价 */
  increases: SubView[];
  /** 资料缺失计数 */
  missing: { manage: number; pay: number; channel: number };
  /** 全部取消「用得少」的订阅，一年可省（分） */
  yearlySavingCents: number;
}

const paidLive = (s: SubView) => s.kind === 'sub' && s.status === 'active' && !s.trialEnd && s.priceCents > 0;

export function buildReview(subs: SubView[], t = today()): Review {
  const paid = subs.filter(paidLive);
  const kept = (s: SubView) => !!s.reviewedAt && diffDays(s.reviewedAt, t) < KEEP_DAYS;
  const waste = paid.filter((s) => (s.usage === 'rarely' || s.usage === 'monthly') && !kept(s)).sort((a, b) => b.monthlyCents - a.monthlyCents);
  const byCat = new Map<string, SubView[]>();
  for (const s of paid) if (OVERLAP_CATS.includes(s.category)) byCat.set(s.category, [...(byCat.get(s.category) ?? []), s]);
  const overlaps = [...byCat.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([category, list]) => ({ category, subs: list.sort((a, b) => b.monthlyCents - a.monthlyCents), monthlyCents: list.reduce((a, s) => a + s.monthlyCents, 0) }))
    .sort((a, b) => b.monthlyCents - a.monthlyCents);
  const byName = new Map<string, SubView[]>();
  for (const s of paid) byName.set(s.name.trim().toLowerCase(), [...(byName.get(s.name.trim().toLowerCase()) ?? []), s]);
  const duplicates = [...byName.values()].filter((l) => new Set(l.map((s) => s.emailId)).size >= 2).map((l) => ({ name: l[0].name, subs: l }));
  const since = addDays(t, -180);
  const increases = subs.filter((s) => s.lastChange && s.lastChange.newCents > s.lastChange.oldCents && s.lastChange.date >= since && s.status === 'active');
  return {
    waste,
    unmarked: paid.filter((s) => !s.usage).sort((a, b) => b.monthlyCents - a.monthlyCents),
    overlaps,
    duplicates,
    increases,
    missing: {
      manage: paid.filter((s) => !s.manageUrl).length,
      pay: subs.filter((s) => s.kind !== 'free' && s.status === 'active' && !s.payMethodId).length,
      channel: subs.filter((s) => s.kind !== 'free' && s.status === 'active' && !s.channel).length,
    },
    yearlySavingCents: waste.reduce((a, s) => a + s.monthlyCents * 12, 0),
  };
}

/** 是否该提醒做体检：从未做过且有 5 个以上付费订阅，或距上次超过 90 天 */
export function reviewDue(lastReview: string | null, subs: SubView[], t = today()): boolean {
  const paid = subs.filter(paidLive).length;
  if (paid < 3) return false;
  if (!lastReview) return paid >= 5;
  return diffDays(lastReview, t) >= KEEP_DAYS;
}
