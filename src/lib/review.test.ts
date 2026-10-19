import { describe, expect, it } from 'vitest';
import { buildReview, reviewDue } from './review';
import type { SubView } from './queries';

let n = 0;
function sub(o: Partial<SubView>): SubView {
  const s = {
    id: ++n, name: 'X', plan: '', category: 'AI', emailId: 1, emailAddress: 'a@x.com', emailProvider: 'Gmail', kind: 'sub', priceCents: 10000, cycle: 'month',
    anchorDay: 1, nextDate: '2026-11-01', trialEnd: null, autoRenew: true, status: 'active', channel: 'PayPal', payMethodId: 1, payName: 'P', url: '', manageUrl: 'https://x',
    login: 'password', mfa: 'none', note: '', snoozeUntil: null, usage: 'daily', reviewedAt: null, lastChange: null,
    state: { label: '', tone: 'green', group: 'active', alert: false, days: 10 }, monthlyCents: 10000, ...o,
  } as SubView;
  return s;
}

describe('buildReview', () => {
  it('finds rarely used subscriptions and yearly savings', () => {
    const r = buildReview([sub({ usage: 'rarely' }), sub({ usage: 'daily' }), sub({ usage: 'monthly', monthlyCents: 5000 })], '2026-10-19');
    expect(r.waste.length).toBe(2);
    expect(r.yearlySavingCents).toBe((10000 + 5000) * 12);
  });
  it('hides subscriptions kept within 90 days', () => {
    expect(buildReview([sub({ usage: 'rarely', reviewedAt: '2026-09-01' })], '2026-10-19').waste.length).toBe(0);
    expect(buildReview([sub({ usage: 'rarely', reviewedAt: '2026-06-01' })], '2026-10-19').waste.length).toBe(1);
  });
  it('detects duplicates across emails and overlapping categories', () => {
    const r = buildReview([sub({ name: 'Claude', emailId: 1 }), sub({ name: 'claude', emailId: 2 }), sub({ name: 'ChatGPT', emailId: 1 })], '2026-10-19');
    expect(r.duplicates.map((d) => d.subs.length)).toEqual([2]);
    expect(r.overlaps[0].subs.length).toBe(3);
  });
  it('lists recent price increases and missing fields', () => {
    const r = buildReview([sub({ lastChange: { date: '2026-09-01', oldCents: 100, newCents: 120 } }), sub({ manageUrl: '', payMethodId: null })], '2026-10-19');
    expect(r.increases.length).toBe(1);
    expect(r.missing).toEqual({ manage: 1, pay: 1, channel: 0 });
  });
  it('ignores trials, cancelled and free items', () => {
    const r = buildReview([sub({ usage: 'rarely', trialEnd: '2026-11-01' }), sub({ usage: 'rarely', status: 'cancelled' }), sub({ usage: '', kind: 'free', priceCents: 0 })], '2026-10-19');
    expect(r.waste.length + r.unmarked.length).toBe(0);
  });
});

describe('reviewDue', () => {
  it('asks for a review every 90 days once there are enough paid subscriptions', () => {
    const many = [sub({}), sub({}), sub({}), sub({}), sub({})];
    expect(reviewDue(null, many, '2026-10-19')).toBe(true);
    expect(reviewDue('2026-09-01', many, '2026-10-19')).toBe(false);
    expect(reviewDue('2026-07-01', many, '2026-10-19')).toBe(true);
    expect(reviewDue(null, [sub({})], '2026-10-19')).toBe(false);
  });
});
