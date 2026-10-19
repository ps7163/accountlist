'use server';

import { redirect } from 'next/navigation';
import { clearFailures, clientKey, createSession, destroySession, hashPassword, isLocked, isSetup, recordFailure, totpSecret, verifyPassword, verifyTotp } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/settings';
import { log } from '@/lib/activity';

export interface FormState {
  error?: string;
}

export async function setupAction(_: FormState, fd: FormData): Promise<FormState> {
  if (isSetup()) redirect('/login');
  const pw = String(fd.get('password') || '');
  const pw2 = String(fd.get('password2') || '');
  if (pw.length < 8) return { error: '密码至少 8 位' };
  if (pw !== pw2) return { error: '两次输入的密码不一致' };
  setSetting('password_hash', hashPassword(pw));
  setSetting('password_changed', new Date().toISOString());
  await createSession(true);
  redirect('/');
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const key = await clientKey();
  const locked = isLocked(key);
  if (locked) return { error: `尝试次数过多，请 ${locked} 分钟后再试` };
  const pw = String(fd.get('password') || '');
  const code = String(fd.get('otp') || '');
  const secret = totpSecret();
  if (!verifyPassword(pw, getSetting('password_hash'))) {
    recordFailure(key);
    log('登录失败', '', `密码错误${key === 'local' ? '' : `，来源 ${key}`}`);
    return { error: '密码不正确' };
  }
  if (secret && !verifyTotp(code, secret)) {
    recordFailure(key);
    return { error: code ? '验证码不正确或已过期' : '请输入两步验证码' };
  }
  clearFailures(key);
  log('登录', '', key === 'local' ? '' : `来源 ${key}`);
  await createSession(fd.get('keep') === 'on');
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
