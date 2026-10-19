import 'server-only';
import { lt } from 'drizzle-orm';
import { db, schema } from './db';

/** 记录一条操作日志（不影响主流程，失败只打印） */
export function log(action: string, target = '', detail = ''): void {
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
