import 'server-only';
import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from './db';

const { apiTokens } = schema;
export type TokenScope = 'read' | 'write';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export const listTokens = () =>
  db.select({ id: apiTokens.id, name: apiTokens.name, prefix: apiTokens.prefix, scope: apiTokens.scope, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt }).from(apiTokens).orderBy(desc(apiTokens.id)).all();

/** 新建令牌，明文只在这里返回一次 */
export function createToken(name: string, scope: TokenScope): { id: number; token: string } {
  const token = `al_${crypto.randomBytes(24).toString('base64url')}`;
  const row = db.insert(apiTokens).values({ name, scope, hash: sha256(token), prefix: token.slice(0, 7) }).returning({ id: apiTokens.id }).get();
  return { id: row.id, token };
}

export function revokeToken(id: number): string | null {
  const row = db.select().from(apiTokens).where(eq(apiTokens.id, Number(id))).get();
  if (!row) return null;
  db.delete(apiTokens).where(eq(apiTokens.id, row.id)).run();
  return row.name;
}

/** 校验 Authorization: Bearer 令牌，并顺手更新最近使用时间（每分钟最多写一次） */
export function verifyBearer(header: string | null): { id: number; name: string; scope: TokenScope } | null {
  const m = header?.match(/^Bearer\s+(al_[\w-]{20,})\s*$/i);
  if (!m) return null;
  const row = db.select().from(apiTokens).where(eq(apiTokens.hash, sha256(m[1]))).get();
  if (!row) return null;
  const at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (!row.lastUsedAt || row.lastUsedAt.slice(0, 16) !== at.slice(0, 16)) db.update(apiTokens).set({ lastUsedAt: at }).where(eq(apiTokens.id, row.id)).run();
  return { id: row.id, name: row.name, scope: row.scope };
}
