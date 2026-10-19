'use client';

import { Fragment, useEffect, useState } from 'react';
import { getSubDetail, saveSubscription, type SubInput } from '@/app/actions';
import { addDays, CYCLE_UNIT, formatYuan, today, type Cycle } from '@/lib/billing';
import { CATEGORIES, CHANNELS, LOGINS, MFAS, TEMPLATES } from '@/lib/constants';
import { Logo } from '../icons';
import { Modal } from '../ui/Modal';
import { useApp } from './AppProvider';

export type SubFormInitial = Omit<SubInput, 'id'>;

function blank(emailId: number): SubFormInitial {
  return {
    name: '', plan: '', category: 'AI', emailId, kind: 'sub', price: '', cycle: 'month', date: addDays(today(), 30), trial: false, autoRenew: true,
    status: 'active', channel: 'Apple App Store', payMethodId: null, newPayName: '', url: '', manageUrl: '', login: 'password', mfa: 'none', note: '',
  };
}

function Radios<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="radios" role="radiogroup">
      {options.map(([v, t]) => (
        <Fragment key={v}>
          <input type="radio" name={name} id={`${name}-${v}`} value={v} checked={value === v} onChange={() => onChange(v)} />
          <label htmlFor={`${name}-${v}`}>{t}</label>
        </Fragment>
      ))}
    </div>
  );
}

export function SubForm({ editId, preset, onClose }: { editId?: number; preset?: Partial<SubFormInitial>; onClose: () => void }) {
  const { data, run } = useApp();
  const [v, setV] = useState<SubFormInitial | null>(editId ? null : { ...blank(data.emails[0]?.id ?? 0), ...preset });
  const [saving, setSaving] = useState(false);
  const [sugOpen, setSugOpen] = useState(false);
  const [error, setError] = useState('');
  const [newPay, setNewPay] = useState(false);

  useEffect(() => {
    if (!editId) return;
    getSubDetail(editId).then((d) => {
      if (!d) return onClose();
      const s = d.sub;
      setV({
        name: s.name, plan: s.plan, category: s.category, emailId: s.emailId, kind: s.kind, price: String(s.priceCents / 100), cycle: s.cycle,
        date: s.trialEnd ?? s.nextDate ?? today(), trial: !!s.trialEnd, autoRenew: s.autoRenew, status: s.status, channel: s.channel || CHANNELS[0],
        payMethodId: s.payMethodId, newPayName: '', url: s.url, manageUrl: s.manageUrl, login: s.login, mfa: s.mfa, note: s.note,
      });
    });
  }, [editId, onClose]);

  if (!data.emails.length) {
    return (
      <Modal title="新建订阅" onClose={onClose} width={480} footer={<a className="btn btn-primary" href="/emails?new=1">去添加邮箱</a>}>
        <p style={{ marginTop: 16 }}>订阅需要关联一个登录邮箱，请先添加邮箱。</p>
      </Modal>
    );
  }
  if (!v) return <Modal title="编辑订阅" onClose={onClose}><div className="empty">加载中…</div></Modal>;

  const set = <K extends keyof SubFormInitial>(k: K, val: SubFormInitial[K]) => setV((o) => (o ? { ...o, [k]: val } : o));
  const q = v.name.trim().toLowerCase();
  const sugs = editId ? [] : TEMPLATES.filter((t) => !q || t.name.toLowerCase().includes(q)).slice(0, 6);
  const isSub = v.kind === 'sub', isFree = v.kind === 'free';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v) return;
    setSaving(true);
    setError('');
    const r = await saveSubscription({ ...v, newPayName: newPay ? v.newPayName : '', payMethodId: newPay ? null : v.payMethodId, id: editId });
    setSaving(false);
    if (!r.ok) return setError(r.error || '保存失败');
    await run(Promise.resolve(r), editId ? '保存成功' : `已添加 ${v.name}`);
    onClose();
  }

  return (
    <Modal
      title={editId ? '编辑订阅' : '新建订阅'}
      onClose={onClose}
      footer={
        <>
          {error && <span className="form-err" style={{ marginRight: 'auto' }}>{error}</span>}
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" form="sub-form" disabled={saving}>{saving ? '保存中…' : editId ? '保存' : '创建'}</button>
        </>
      }
    >
      <form id="sub-form" onSubmit={submit}>
        <div className="form-sec">基本信息</div>
        <div className="fg">
          <div className="f" style={{ position: 'relative' }}>
            <label htmlFor="f-name" className="req">服务名称</label>
            <input className="inp" id="f-name" required autoComplete="off" value={v.name} placeholder="输入名称，可从模板快速填写"
              onChange={(e) => { set('name', e.target.value); setSugOpen(true); }} onFocus={() => setSugOpen(true)} onBlur={() => setTimeout(() => setSugOpen(false), 120)} />
            {sugOpen && sugs.length > 0 && (
              <div className="sug">
                <div className="sug-h">{q ? '匹配的服务模板' : '常用服务 · 选择后自动填写'}</div>
                {sugs.map((t) => (
                  <button type="button" key={t.name} className="sug-i" onMouseDown={(e) => {
                    e.preventDefault();
                    setV((o) => o && { ...o, name: t.name, plan: t.plan, category: CATEGORIES.includes(t.cat) ? t.cat : '其他', price: String(t.price), cycle: t.cycle, url: t.url, manageUrl: t.manage });
                    setSugOpen(false);
                  }}>
                    <Logo name={t.name} />
                    <span className="grow">{t.name} <span className="t3">{t.plan}</span></span>
                    <span className="num t2">{formatYuan(t.price * 100, 0)}/{CYCLE_UNIT[t.cycle]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="f">
            <label htmlFor="f-plan">订阅档位</label>
            <input className="inp" id="f-plan" value={v.plan} onChange={(e) => set('plan', e.target.value)} placeholder="如 Pro / Plus / Max" list="plans" />
            <datalist id="plans"><option>Pro</option><option>Plus</option><option>Max</option><option>Team</option><option>Free</option></datalist>
          </div>
          <div className="f">
            <label htmlFor="f-email" className="req">登录邮箱</label>
            <select className="sel" id="f-email" value={v.emailId} onChange={(e) => set('emailId', Number(e.target.value))}>
              {data.emails.map((e) => <option key={e.id} value={e.id}>{e.address}</option>)}
            </select>
          </div>
          <div className="f">
            <label htmlFor="f-cat">分类</label>
            <select className="sel" id="f-cat" value={v.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="f">
            <label htmlFor="f-url">服务网址</label>
            <input className="inp" id="f-url" value={v.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" />
          </div>
          <div className="f">
            <label htmlFor="f-manage">管理订阅链接</label>
            <input className="inp" id="f-manage" value={v.manageUrl} onChange={(e) => set('manageUrl', e.target.value)} placeholder="取消或更改套餐的页面" />
          </div>
        </div>

        <div className="form-sec">登录与安全</div>
        <div className="fg">
          <div className="f">
            <label htmlFor="f-login">登录方式</label>
            <select className="sel" id="f-login" value={v.login} onChange={(e) => set('login', e.target.value)}>
              {Object.entries(LOGINS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
            <span className="hint">用 Google / Apple 登录的服务会计入「邮箱影响面」</span>
          </div>
          <div className="f">
            <label htmlFor="f-mfa">两步验证</label>
            <select className="sel" id="f-mfa" value={v.mfa} onChange={(e) => set('mfa', e.target.value)}>
              {Object.entries(MFAS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="form-sec">计费信息</div>
        <div className="fg">
          <div className="f full">
            <span className="lab">计费方式</span>
            <Radios name="f-kind" value={v.kind} options={[['sub', '订阅'], ['once', '一次性买断'], ['free', '免费 / 仅注册']]} onChange={(k) => set('kind', k)} />
          </div>
          {!isFree && (
            <>
              <div className="f">
                <label htmlFor="f-price" className="req">金额</label>
                <div className="affix"><span>¥</span><input className="inp num" type="number" id="f-price" step="0.01" min="0" value={v.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" style={{ width: '100%' }} /></div>
              </div>
              {isSub && (
                <div className="f">
                  <span className="lab">计费周期</span>
                  <Radios name="f-cycle" value={v.cycle} options={[['week', '周'], ['month', '月'], ['quarter', '季'], ['year', '年']] as [Cycle, string][]} onChange={(c) => set('cycle', c)} />
                </div>
              )}
              <div className="f">
                <label htmlFor="f-date" className="req">{v.kind === 'once' ? '购买日期' : v.trial ? '试用结束日期' : '下次扣费日期'}</label>
                <input className="inp" type="date" id="f-date" value={v.date} onChange={(e) => set('date', e.target.value)} required />
              </div>
            </>
          )}
          {isSub && (
            <>
              <div className="f">
                <label htmlFor="f-status">状态</label>
                <select className="sel" id="f-status" value={v.status} onChange={(e) => set('status', e.target.value as SubFormInitial['status'])}>
                  <option value="active">使用中</option><option value="cancelled">已取消</option><option value="expired">已过期</option>
                </select>
              </div>
              <div className="f">
                <label className="sw"><input type="checkbox" checked={v.trial} onChange={(e) => set('trial', e.target.checked)} />免费试用中</label>
                <span className="hint">开启后，上方日期填写试用结束日</span>
              </div>
              <div className="f">
                <label className="sw"><input type="checkbox" checked={v.autoRenew} onChange={(e) => set('autoRenew', e.target.checked)} />自动续费</label>
                <span className="hint">到期后自动顺延一个周期并记录付费</span>
              </div>
            </>
          )}
        </div>

        {!isFree && (
          <>
            <div className="form-sec">支付信息</div>
            <div className="fg">
              <div className="f">
                <label htmlFor="f-channel">付费渠道</label>
                <select className="sel" id="f-channel" value={v.channel} onChange={(e) => set('channel', e.target.value)}>
                  {CHANNELS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="f">
                <label htmlFor="f-pay">支付方式</label>
                <select className="sel" id="f-pay" value={newPay ? 'new' : v.payMethodId ?? ''}
                  onChange={(e) => { const x = e.target.value; setNewPay(x === 'new'); set('payMethodId', x && x !== 'new' ? Number(x) : null); }}>
                  <option value="">不指定</option>
                  {data.payMethods.map((p) => <option key={p.id} value={p.id}>{p.name}（{p.type}）</option>)}
                  <option value="new">＋ 新建支付方式…</option>
                </select>
                {newPay && (
                  <input className="inp" aria-label="新支付方式名称" autoFocus value={v.newPayName ?? ''} onChange={(e) => set('newPayName', e.target.value)} placeholder="如：招行信用卡 尾号 1234" />
                )}
              </div>
            </div>
          </>
        )}

        <div className="form-sec">备注</div>
        <div className="f">
          <textarea aria-label="备注" value={v.note} onChange={(e) => set('note', e.target.value)} placeholder="选填。更多内容可以写在「备注卡片」里" />
        </div>
      </form>
    </Modal>
  );
}
