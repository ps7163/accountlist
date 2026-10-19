import { describe, expect, it } from 'vitest';
import { addCycle, diffDays, isValidDate, monthlyCents, parseYuan, projectedDates, rollForward, subState, type BillingLike } from './billing';

const base: BillingLike = { kind: 'sub', status: 'active', cycle: 'month', priceCents: 14800, nextDate: '2026-10-22', trialEnd: null, autoRenew: true, anchorDay: 22 };

describe('addCycle', () => {
  it('keeps the anchor day across short months', () => {
    expect(addCycle('2026-01-31', 'month', 1, 31)).toBe('2026-02-28');
    expect(addCycle('2026-02-28', 'month', 1, 31)).toBe('2026-03-31');
    expect(addCycle('2024-01-31', 'month', 1, 31)).toBe('2024-02-29');
  });
  it('handles quarters, years and weeks', () => {
    expect(addCycle('2026-11-30', 'quarter', 1, 30)).toBe('2027-02-28');
    expect(addCycle('2024-02-29', 'year', 1, 29)).toBe('2025-02-28');
    expect(addCycle('2026-12-29', 'week')).toBe('2027-01-05');
    expect(addCycle('2026-03-15', 'month', -1)).toBe('2026-02-15');
  });
});

describe('rollForward', () => {
  it('records each missed period and moves the date past today', () => {
    const r = rollForward({ ...base, nextDate: '2026-08-22' }, '2026-10-19');
    expect(r.paidDates).toEqual(['2026-08-22', '2026-09-22']);
    expect(r.nextDate).toBe('2026-10-22');
  });
  it('does nothing when the charge day is today or later', () => {
    expect(rollForward({ ...base, nextDate: '2026-10-19' }, '2026-10-19').paidDates).toEqual([]);
  });
  it('ignores subscriptions without auto renew or not active', () => {
    expect(rollForward({ ...base, nextDate: '2026-01-01', autoRenew: false }, '2026-10-19').paidDates).toEqual([]);
    expect(rollForward({ ...base, nextDate: '2026-01-01', status: 'cancelled' }, '2026-10-19').paidDates).toEqual([]);
  });
  it('converts an ended trial into a paid subscription', () => {
    const r = rollForward({ ...base, trialEnd: '2026-10-10', nextDate: '2026-10-10', anchorDay: 10 }, '2026-10-19');
    expect(r.trialEnd).toBeNull();
    expect(r.paidDates).toEqual(['2026-10-10']);
    expect(r.nextDate).toBe('2026-11-10');
  });
});

describe('subState', () => {
  it('flags upcoming, overdue and trial subscriptions', () => {
    expect(subState(base, '2026-10-19', 7)).toMatchObject({ label: '3 天后到期', alert: true });
    expect(subState({ ...base, nextDate: '2026-12-01' }, '2026-10-19', 7)).toMatchObject({ label: '使用中', alert: false });
    expect(subState({ ...base, nextDate: '2026-10-17', autoRenew: false }, '2026-10-19', 7)).toMatchObject({ label: '已过期 2 天', tone: 'red' });
    expect(subState({ ...base, trialEnd: '2026-10-25' }, '2026-10-19', 7)).toMatchObject({ group: 'trial', alert: true });
  });
  it('hides snoozed items from the to-do list until the date passes', () => {
    expect(subState({ ...base, snoozeUntil: '2026-10-21' }, '2026-10-19', 7).alert).toBe(false);
    expect(subState({ ...base, snoozeUntil: '2026-10-19' }, '2026-10-19', 7).alert).toBe(true);
  });
});

describe('money and dates', () => {
  it('converts prices to monthly cents', () => {
    expect(monthlyCents({ ...base, cycle: 'year', priceCents: 120000 })).toBe(10000);
    expect(monthlyCents({ ...base, trialEnd: '2026-11-01' })).toBe(0);
  });
  it('parses yuan input safely', () => {
    expect(parseYuan('148')).toBe(14800);
    expect(parseYuan('¥1,380.5')).toBe(138050);
    expect(parseYuan('abc')).toBe(0);
    expect(parseYuan('-5')).toBe(0);
  });
  it('validates dates', () => {
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(diffDays('2026-10-19', '2026-10-22')).toBe(3);
  });
  it('projects charge dates within a month', () => {
    expect(projectedDates({ ...base, cycle: 'week', nextDate: '2026-10-05' }, '2026-10-01', '2026-10-31', '2026-10-01')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  });
});
