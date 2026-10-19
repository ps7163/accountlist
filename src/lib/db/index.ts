import 'server-only';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __accountlistDb?: DB; __accountlistSqlite?: Database.Database };

export const dataDir = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');

function open(): DB {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(path.join(dir, 'accountlist.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  globalForDb.__accountlistSqlite = sqlite;
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  return db;
}

/** 首次使用时才打开数据库，避免构建阶段创建数据文件 */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const real = (globalForDb.__accountlistDb ??= open()) as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});
export { schema };
export const rawSqlite = () => {
  if (!globalForDb.__accountlistSqlite) globalForDb.__accountlistDb ??= open();
  return globalForDb.__accountlistSqlite!;
};
