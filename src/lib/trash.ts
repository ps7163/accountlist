import 'server-only';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { db, schema } from './db';
import { log } from './activity';
import type { TrashType } from '@/app/actions';

const { subscriptions, emails, payMethods, notes } = schema;

export interface TrashItem {
  type: TrashType;
  id: number;
  title: string;
  sub: string;
  deletedAt: string;
}

/** 回收站列表，按删除时间倒序 */
export function listTrash(): TrashItem[] {
  const items: TrashItem[] = [];
  const emailMap = new Map(db.select().from(emails).all().map((e) => [e.id, e]));
  for (const s of db.select().from(subscriptions).where(isNotNull(subscriptions.deletedAt)).all()) {
    items.push({ type: 'sub', id: s.id, title: `${s.name} ${s.plan}`.trim(), sub: emailMap.get(s.emailId)?.address ?? '', deletedAt: s.deletedAt! });
  }
  for (const e of emailMap.values()) if (e.deletedAt) items.push({ type: 'email', id: e.id, title: e.address, sub: e.note, deletedAt: e.deletedAt });
  for (const p of db.select().from(payMethods).where(isNotNull(payMethods.deletedAt)).all()) items.push({ type: 'pay', id: p.id, title: p.name, sub: p.type, deletedAt: p.deletedAt! });
  // 随账号一起删除的卡片会在恢复账号时一起恢复，这里只列单独删除的卡片
  const deletedSubs = new Set(items.filter((x) => x.type === 'sub').map((x) => x.id));
  const deletedEmails = new Set(items.filter((x) => x.type === 'email').map((x) => x.id));
  for (const n of db.select().from(notes).where(isNotNull(notes.deletedAt)).all()) {
    if ((n.targetType === 'sub' ? deletedSubs : deletedEmails).has(n.targetId)) continue;
    items.push({ type: 'note', id: n.id, title: n.title, sub: '备注卡片', deletedAt: n.deletedAt! });
  }
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

function purgeSub(id: number) {
  db.delete(notes).where(and(eq(notes.targetType, 'sub'), eq(notes.targetId, id))).run();
  db.delete(subscriptions).where(eq(subscriptions.id, id)).run(); // 付费记录、价格变动随之级联删除
}

/** 彻底删除回收站里的一项 */
export function purge(type: TrashType, id: number): { ok: boolean; error?: string } {
  let label = '';
  const ok = db.transaction(() => {
    if (type === 'sub') {
      const s = db.select().from(subscriptions).where(eq(subscriptions.id, id)).get();
      if (!s?.deletedAt) return false;
      label = `${s.name} ${s.plan}`.trim();
      purgeSub(id);
    } else if (type === 'email') {
      const e = db.select().from(emails).where(eq(emails.id, id)).get();
      if (!e?.deletedAt) return false;
      label = e.address;
      const subs = db.select().from(subscriptions).where(eq(subscriptions.emailId, id)).all();
      if (subs.some((s) => !s.deletedAt)) return false;
      subs.forEach((s) => purgeSub(s.id));
      db.delete(notes).where(and(eq(notes.targetType, 'email'), eq(notes.targetId, id))).run();
      db.delete(emails).where(eq(emails.id, id)).run();
    } else if (type === 'pay') {
      const p = db.select().from(payMethods).where(eq(payMethods.id, id)).get();
      if (!p?.deletedAt) return false;
      label = p.name;
      db.update(subscriptions).set({ payMethodId: null }).where(eq(subscriptions.payMethodId, id)).run();
      db.delete(payMethods).where(eq(payMethods.id, id)).run();
    } else {
      const n = db.select().from(notes).where(eq(notes.id, id)).get();
      if (!n?.deletedAt) return false;
      label = n.title;
      db.delete(notes).where(eq(notes.id, id)).run();
    }
    return true;
  });
  if (!ok) return { ok: false, error: '回收站里没有这一项' };
  log('彻底删除', label);
  return { ok: true };
}

/** 清理删除超过 days 天的项目，返回数量 */
export function purgeOlderThan(days: number): number {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  let count = 0;
  const run = (type: TrashType, ids: number[]) => ids.forEach((id) => purge(type, id).ok && count++);
  run('note', db.select({ id: notes.id }).from(notes).where(lt(notes.deletedAt, cutoff)).all().map((r) => r.id));
  run('sub', db.select({ id: subscriptions.id }).from(subscriptions).where(lt(subscriptions.deletedAt, cutoff)).all().map((r) => r.id));
  run('pay', db.select({ id: payMethods.id }).from(payMethods).where(lt(payMethods.deletedAt, cutoff)).all().map((r) => r.id));
  run('email', db.select({ id: emails.id }).from(emails).where(lt(emails.deletedAt, cutoff)).all().map((r) => r.id));
  return count;
}
