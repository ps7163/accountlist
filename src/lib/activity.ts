import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { lt } from 'drizzle-orm';
import { db, schema } from './db';

const actor = new AsyncLocalStorage<string>();

/** 以某个身份执行（如 API 令牌），期间的日志会标明来源 */
export const runAs = <T>(who: string, fn: () => T): T => actor.run(who, fn);

/** 记录一条操作日志（不影响主流程，失败只打印） */
export function log(action: string, target = '', detail = ''): void {
  const who = actor.getStore();
  if (who) detail = detail ? `${detail} · 来自 ${who}` : `来自 ${who}`;
  try {
    db.insert(schema.activity).values({ action, target: target.slice(0, 200), detail: detail.slice(0, 500) }).run();
  } catch (e) {
    console.error('[activity]', e);
  }
}

/** 只保留最近 365 天的日志 */
export function pruneActivity(): void {
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  db.delete(schema.activity).where(lt(schema.activity.at, cutoff)).run();
}
