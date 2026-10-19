'use client';

import { useState } from 'react';
import { batchSubs, markRenewed } from '@/app/actions';
import { CYCLE_LABEL, CYCLE_UNIT, formatYuan } from '@/lib/billing';
import type { SubView } from '@/lib/queries';
import { Logo } from '../icons';
import { StateTag } from '../ui/Tag';
import { useApp } from './AppProvider';

export function SubTable({ rows }: { rows: SubView[] }) {
  const { run, openDetail, openEdit } = useApp();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [confirmDel, setConfirmDel] = useState(false);
  const all = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const toggle = (id: number) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const batch = async (op: 'renew' | 'cancel' | 'delete', label: string) => {
    const r = await run(batchSubs([...picked], op), (x) => `已${label} ${x.count} 项`);
    if (r) { setPicked(new Set()); setConfirmDel(false); }
  };
  const live = (s: SubView) => s.kind === 'sub' && s.status === 'active' && !s.trialEnd && !!s.nextDate;
  const price = (s: SubView) => (s.kind === 'free' ? '免费' : formatYuan(s.priceCents) + (s.kind === 'sub' ? `/${CYCLE_UNIT[s.cycle]}` : ''));

  return (
    <>
      {picked.size > 0 && (
        <div className="batch">
          已选择 {picked.size} 项
          <button className="btn-text" onClick={() => batch('renew', '续费')}>标记已续费</button>
          <button className="btn-text" onClick={() => batch('cancel', '取消')}>标记已取消</button>
          {confirmDel ? (
            <button className="btn-text danger" onClick={() => batch('delete', '删除')}>确认删除 {picked.size} 项？</button>
          ) : (
            <button className="btn-text danger" onClick={() => setConfirmDel(true)}>删除</button>
          )}
          <button className="btn-text" style={{ marginLeft: 'auto', color: 'var(--text-2)' }} onClick={() => { setPicked(new Set()); setConfirmDel(false); }}>取消选择</button>
        </div>
      )}
      <div className="tbl-wrap hide-m">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 44 }}><input type="checkbox" className="ck" checked={all} aria-label="全选本页" onChange={() => setPicked(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
              <th>服务</th><th>登录邮箱</th><th>付费渠道 / 支付方式</th><th className="r">金额</th><th>周期</th><th>下次扣费</th><th>状态</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className={`row ${picked.has(s.id) ? 'sel' : ''}`} onClick={(e) => { if (!(e.target as HTMLElement).closest('input,button,a')) openDetail(s.id); }}>
                <td><input type="checkbox" className="ck" checked={picked.has(s.id)} onChange={() => toggle(s.id)} aria-label={`选择 ${s.name}`} /></td>
                <td><div className="svc"><Logo name={s.name} /><div><div>{s.name}</div><div className="sub">{[s.plan, s.category].filter(Boolean).join(' · ')}</div></div></div></td>
                <td className="t2">{s.emailAddress}</td>
                <td>{s.channel ? <><div>{s.channel}</div><div className="sub">{s.payName || '—'}</div></> : <span className="t3">—</span>}</td>
                <td className="r">{s.kind === 'free' ? <span className="t3">免费</span> : <span className="num">{formatYuan(s.priceCents)}</span>}</td>
                <td className="t2">{s.kind === 'free' ? '—' : s.kind === 'once' ? '一次性' : CYCLE_LABEL[s.cycle]}</td>
                <td className="num">{s.kind === 'sub' ? s.trialEnd ?? s.nextDate ?? '—' : '—'}</td>
                <td><StateTag state={s.state} /></td>
                <td>
                  <div className="ops">
                    <button className="btn-text" onClick={() => openEdit(s.id)}>编辑</button>
                    {live(s) && <button className="btn-text" onClick={() => run(markRenewed(s.id), (r) => `已记录续费，下次扣费 ${r.nextDate}`)}>续费</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mlist">
        {rows.map((s) => (
          <div key={s.id} className="mcard" role="button" tabIndex={0} onClick={() => openDetail(s.id)} onKeyDown={(e) => e.key === 'Enter' && openDetail(s.id)}>
            <div className="top"><Logo name={s.name} /><div className="grow"><div className="ell">{s.name} <span className="t3">{s.plan}</span></div></div><StateTag state={s.state} /></div>
            <div className="meta"><span className="ell">{s.emailAddress}</span><span className="num" style={{ color: 'var(--text)', flex: 'none' }}>{price(s)}</span></div>
            <div className="meta"><span className="ell">{s.channel || (s.kind === 'free' ? '仅注册' : '未填渠道')}</span><span className="num" style={{ flex: 'none' }}>{s.kind === 'sub' ? s.trialEnd ?? s.nextDate ?? '' : ''}</span></div>
          </div>
        ))}
      </div>
    </>
  );
}
