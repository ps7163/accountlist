import 'server-only';
import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { authenticator } from 'otplib';
import { getSetting, sessionSecret, setSetting } from './settings';

const COOKIE = 'al_session';
authenticator.options = { window: 1 };

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string | null): boolean {
  if (!stored) return false;
  const [algo, saltHex, hashHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

export const isSetup = () => !!getSetting('password_hash');
export const totpSecret = () => getSetting('totp_secret');
export const verifyTotp = (code: string, secret: string) => authenticator.verify({ token: code.replace(/\s/g, ''), secret });
export const newTotpSecret = () => authenticator.generateSecret();
export const totpUri = (secret: string) => authenticator.keyuri('admin', '账号簿', secret);

function sessionVersion(): number {
  return Number(getSetting('session_version') || '1');
}

async function secureCookie(): Promise<boolean> {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return (await headers()).get('x-forwarded-proto') === 'https';
}

export async function createSession(keep: boolean): Promise<void> {
  const maxAge = keep ? 30 * 86400 : 12 * 3600;
  const token = await new SignJWT({ v: sessionVersion() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(sessionSecret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: await secureCookie(), path: '/', maxAge: keep ? maxAge : undefined });
}

export async function isAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ['HS256'] });
    return payload.v === sessionVersion();
  } catch {
    return false;
  }
}

/** 页面和服务端操作的统一鉴权入口 */
export async function requireAuth(): Promise<void> {
  if (!isSetup()) redirect('/setup');
  if (!(await isAuthenticated())) redirect('/login');
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** 让其他设备上的登录全部失效，当前设备重新签发 */
export async function revokeOtherSessions(): Promise<void> {
  setSetting('session_version', String(sessionVersion() + 1));
  await createSession(true);
}

/* 登录失败限流：同一来源 10 分钟内最多失败 5 次 */
const failures = new Map<string, { count: number; until: number }>();
export async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'local';
}
export function isLocked(key: string): number {
  const f = failures.get(key);
  if (!f || f.until < Date.now()) return 0;
  return f.count >= 5 ? Math.ceil((f.until - Date.now()) / 60000) : 0;
}
export function recordFailure(key: string): void {
  const f = failures.get(key);
  const until = Date.now() + 10 * 60 * 1000;
  failures.set(key, { count: f && f.until > Date.now() ? f.count + 1 : 1, until });
}
export function clearFailures(key: string): void {
  failures.delete(key);
}
