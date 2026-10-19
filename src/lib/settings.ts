import 'server-only';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db, schema } from './db';

export function getSetting(key: string): string | null {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } }).run();
}

export function deleteSetting(key: string): void {
  db.delete(schema.settings).where(eq(schema.settings.key, key)).run();
}

/** 会话签名密钥：首次使用时随机生成并保存在数据库里 */
export function sessionSecret(): Uint8Array {
  let s = getSetting('session_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setSetting('session_secret', s);
  }
  return new TextEncoder().encode(s);
}

export interface Prefs {
  remindDays: number;
  skin: string;
  displayName: string;
}

export function getPrefs(): Prefs {
  const n = Number(getSetting('remind_days'));
  return {
    remindDays: Number.isInteger(n) && n >= 1 && n <= 60 ? n : 7,
    skin: getSetting('skin') || 'sky',
    displayName: getSetting('display_name') || '管理员',
  };
}
