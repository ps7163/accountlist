'use client';

import { useActionState } from 'react';
import type { FormState } from './auth-actions';

const Brand = () => (
  <div className="logo-row" style={{ padding: 0, height: 'auto' }}>
    <span className="logo-mark">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M5 7h14M5 12h14M5 17h8" /></svg>
    </span>
    账号簿
  </div>
);

export function AuthForm({ mode, action, needOtp }: { mode: 'setup' | 'login'; action: (s: FormState, fd: FormData) => Promise<FormState>; needOtp?: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <div className="login">
      <form className="card login-card" action={formAction}>
        <Brand />
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px' }}>{mode === 'setup' ? '设置登录密码' : '登录'}</div>
          <div className="t3" style={{ fontSize: 13 }}>{mode === 'setup' ? '首次使用，请设置一个只有你知道的密码（至少 8 位）' : '个人账号与订阅管理'}</div>
        </div>
        <div className="f">
          <label htmlFor="password">密码</label>
          <input className="inp" type="password" id="password" name="password" required autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} autoFocus />
        </div>
        {mode === 'setup' ? (
          <div className="f">
            <label htmlFor="password2">再输入一次</label>
            <input className="inp" type="password" id="password2" name="password2" required autoComplete="new-password" />
          </div>
        ) : needOtp ? (
          <div className="f">
            <label htmlFor="otp">两步验证码</label>
            <input className="inp" type="text" id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="请输入验证器中的 6 位数字" />
          </div>
        ) : null}
        {mode === 'login' && (
          <label className="sw">
            <input type="checkbox" name="keep" defaultChecked />
            30 天内免登录
          </label>
        )}
        {state.error && <div className="form-err" role="alert">{state.error}</div>}
        <button className="btn btn-primary" style={{ height: 40 }} disabled={pending}>
          {pending ? '请稍候…' : mode === 'setup' ? '完成设置' : '登录'}
        </button>
      </form>
    </div>
  );
}
