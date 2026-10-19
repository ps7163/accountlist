'use client';

import { useEffect, useState } from 'react';
import { savePrefs } from '@/app/actions';
import { changePassword, disableTotp, enableTotp, logoutOthers, resetCalendarToken, saveFeishuConfig, startTotp, testFeishu } from '@/app/settings-actions';
import type { FeishuConfig } from '@/lib/notify';
import { Modal } from '../ui/Modal';
import { Tag } from '../ui/Tag';
import { useApp } from './AppProvider';

export function PrefsForm({ remindDays, displayName }: { remindDays: number; displayName: string }) {
  const { run } = useApp();
  const [days, setDays] = useState(String(remindDays));
  const [name, setName] = useState(displayName);
  return (
    <>
      <div className="set">
        <div><h3>提前提醒天数</h3><p>到期前多少天在工作台、铃铛和推送中提醒</p></div>
        <div className="ctl">
          <input className="inp num" type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 96 }} aria-label="提前提醒天数" /> 天
          <button className="btn" onClick={() => run(savePrefs({ remindDays: Number(days) }), '已保存')}>保存</button>
        </div>
      </div>
      <div className="set">
        <div><h3>称呼</h3><p>工作台问候语里显示的名字</p></div>
        <div className="ctl">
          <input className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} style={{ width: 160 }} aria-label="称呼" />
          <button className="btn" onClick={() => run(savePrefs({ displayName: name }), '已保存')}>保存</button>
        </div>
      </div>
    </>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const { toast } = useApp();
  return (
    <div className="copy-row">
      <input className="inp" readOnly value={value} aria-label={label} onFocus={(e) => e.target.select()} />
      <button className="btn" onClick={(e) => {
        const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
        navigator.clipboard?.writeText(value).then(() => toast('已复制'), () => { input.select(); toast('已选中，请按 Ctrl+C 复制'); }) ?? (input.select(), toast('已选中，请按 Ctrl+C 复制'));
      }}>复制链接</button>
    </div>
  );
}

export function CalendarSetting({ token }: { token: string }) {
  const { run } = useApp();
  const [tok, setTok] = useState(token);
  const [confirm, setConfirm] = useState(false);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const url = origin ? `${origin}/api/calendar/${tok}.ics` : '';
  return (
    <div className="set">
      <div><h3>日历订阅</h3><p>把扣费日、试用结束日同步到手机日历（iPhone、Google 日历、飞书日历都支持），由手机按时提醒</p></div>
      <div className="ctl" style={{ display: 'grid', gap: 6 }}>
        <CopyField value={url} label="日历订阅链接" />
        <span className="hint">iPhone：设置 → 日历 → 账户 → 添加账户 → 其他 → 添加已订阅的日历，粘贴链接即可。链接相当于钥匙，请勿外传。</span>
        <div>
          {confirm ? (
            <button className="btn-text danger" onClick={async () => { const r = await run(resetCalendarToken(), '已生成新链接，旧链接失效'); if (r?.token) setTok(r.token); setConfirm(false); }}>确认重置（旧链接将失效）</button>
          ) : <button className="btn-text" onClick={() => setConfirm(true)}>重置链接</button>}
        </div>
      </div>
    </div>
  );
}

export function FeishuSetting({ initial }: { initial: FeishuConfig }) {
  const { run } = useApp();
  const [c, setC] = useState<FeishuConfig>({ ...initial, secret: initial.secret ? '••••••' : '' });
  const set = <K extends keyof FeishuConfig>(k: K, v: FeishuConfig[K]) => setC({ ...c, [k]: v });
  const kind = (k: keyof FeishuConfig['kinds'], label: string) => (
    <label className="sw"><input type="checkbox" checked={c.kinds[k]} onChange={(e) => setC({ ...c, kinds: { ...c.kinds, [k]: e.target.checked } })} />{label}</label>
  );
  return (
    <div className="set">
      <div><h3>飞书机器人推送</h3><p>每天定时把待办推送到飞书群。在飞书群设置 → 群机器人 → 添加「自定义机器人」获取 Webhook 地址</p></div>
      <div className="ctl" style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
        <label className="sw"><input type="checkbox" checked={c.enabled} onChange={(e) => set('enabled', e.target.checked)} />开启推送</label>
        <div className="copy-row"><input className="inp" value={c.webhook} onChange={(e) => set('webhook', e.target.value)} placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/…" aria-label="Webhook 地址" /></div>
        <div className="copy-row"><input className="inp" value={c.secret} onChange={(e) => set('secret', e.target.value)} placeholder="签名密钥（机器人开启「签名校验」时填写，选填）" aria-label="签名密钥" /></div>
        <div className="copy-row"><input className="inp" value={c.appUrl} onChange={(e) => set('appUrl', e.target.value)} placeholder="账号簿的访问地址，如 https://acct.example.com（选填，用于消息里的链接）" aria-label="访问地址" /></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="t2">推送时间</span>
          <input className="inp" type="time" value={c.time} onChange={(e) => set('time', e.target.value)} aria-label="推送时间" />
          <label className="sw"><input type="checkbox" checked={c.workdaysOnly} onChange={(e) => set('workdaysOnly', e.target.checked)} />仅工作日</label>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{kind('due', '到期提醒')}{kind('trial', '试用结束')}{kind('pay', '支付方式过期')}{kind('security', '每周一安全检查')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => run(saveFeishuConfig(c), '推送设置已保存')}>保存</button>
          <button className="btn" onClick={() => run(testFeishu(), '已向飞书发送测试消息')}>发送测试</button>
        </div>
        <span className="hint">没有待办的日子不会推送。</span>
      </div>
    </div>
  );
}

export function PasswordSetting({ changed }: { changed: string }) {
  const { run } = useApp();
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="set">
      <div><h3>登录密码</h3><p>{changed ? `上次修改于 ${changed.slice(0, 10)}` : '已设置'}</p></div>
      <div className="ctl"><button className="btn" onClick={() => setOpen(true)}>修改密码</button></div>
      {open && (
        <Modal title="修改密码" onClose={() => setOpen(false)} width={460}
          footer={<>{error && <span className="form-err">{error}</span>}<button className="btn" onClick={() => setOpen(false)}>取消</button><button className="btn btn-primary" form="pw-form">保存</button></>}>
          <form id="pw-form" onSubmit={async (e) => {
            e.preventDefault();
            if (next !== next2) return setError('两次输入的新密码不一致');
            const r = await changePassword(cur, next);
            if (!r.ok) return setError(r.error || '修改失败');
            await run(Promise.resolve(r), '密码已修改，其他设备需要重新登录');
            setOpen(false);
          }}>
            <div className="fg" style={{ paddingTop: 16, gridTemplateColumns: '1fr' }}>
              <div className="f"><label htmlFor="pw-cur">当前密码</label><input className="inp" id="pw-cur" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} /></div>
              <div className="f"><label htmlFor="pw-new">新密码（至少 8 位）</label><input className="inp" id="pw-new" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} /></div>
              <div className="f"><label htmlFor="pw-new2">再输入一次</label><input className="inp" id="pw-new2" type="password" autoComplete="new-password" required value={next2} onChange={(e) => setNext2(e.target.value)} /></div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function TotpSetting({ enabled }: { enabled: boolean }) {
  const { run } = useApp();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="set">
      <div><h3>两步验证</h3><p>登录时还需输入验证器 App（Google Authenticator、1Password、微软验证器等）里的 6 位码</p></div>
      <div className="ctl">
        {enabled ? (
          <><Tag tone="green">已开启</Tag><button className="btn-text danger" onClick={() => { setDisabling(true); setCode(''); setError(''); }}>关闭</button></>
        ) : (
          <><Tag tone="orange">未开启</Tag><button className="btn" onClick={async () => { const r = await startTotp(); if (r.secret && r.qr) { setSetup({ secret: r.secret, qr: r.qr }); setCode(''); setError(''); } }}>开启两步验证</button></>
        )}
      </div>
      {setup && (
        <Modal title="开启两步验证" onClose={() => setSetup(null)} width={480}
          footer={<>{error && <span className="form-err">{error}</span>}<button className="btn" onClick={() => setSetup(null)}>取消</button><button className="btn btn-primary" form="totp-form">验证并开启</button></>}>
          <form id="totp-form" style={{ paddingTop: 16, display: 'grid', gap: 12, justifyItems: 'start' }} onSubmit={async (e) => {
            e.preventDefault();
            const r = await enableTotp(setup.secret, code);
            if (!r.ok) return setError(r.error || '验证失败');
            await run(Promise.resolve(r), '两步验证已开启');
            setSetup(null);
          }}>
            <p style={{ margin: 0 }}>1. 用验证器 App 扫描二维码：</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="两步验证二维码" width={180} height={180} style={{ borderRadius: 8, border: '1px solid var(--border)' }} />
            <p className="hint" style={{ margin: 0 }}>无法扫码时手动输入密钥：<code style={{ userSelect: 'all' }}>{setup.secret}</code></p>
            <label htmlFor="totp-code">2. 输入 App 里显示的 6 位数字：</label>
            <input className="inp num" id="totp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 160 }} />
          </form>
        </Modal>
      )}
      {disabling && (
        <Modal title="关闭两步验证" onClose={() => setDisabling(false)} width={420}
          footer={<>{error && <span className="form-err">{error}</span>}<button className="btn" onClick={() => setDisabling(false)}>取消</button><button className="btn btn-danger-t" form="totp-off">确认关闭</button></>}>
          <form id="totp-off" style={{ paddingTop: 16, display: 'grid', gap: 8 }} onSubmit={async (e) => {
            e.preventDefault();
            const r = await disableTotp(code);
            if (!r.ok) return setError(r.error || '验证失败');
            await run(Promise.resolve(r), '两步验证已关闭');
            setDisabling(false);
          }}>
            <label htmlFor="totp-off-code">请输入当前验证码：</label>
            <input className="inp num" id="totp-off-code" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 160 }} />
          </form>
        </Modal>
      )}
    </div>
  );
}

export function LogoutOthers() {
  const { run } = useApp();
  return <button className="btn" onClick={() => run(logoutOthers(), '其他设备已退出登录')}>退出其他设备</button>;
}
