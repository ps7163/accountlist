'use client';

import { useEffect, useState } from 'react';
import { addPayment, convertTrial, deletePayment, deleteSubscription, getSubDetail, markRenewed } from '@/app/actions';
import { CYCLE_LABEL, CYCLE_UNIT, diffDays, formatYuan, today, weekday } from '@/lib/billing';
import { GUIDES, LOGINS, MFAS, USAGES, maskPhone } from '@/lib/constants';
import { Logo } from '../icons';
import { Drawer } from '../ui/Modal';
import { StateTag, Tag } from '../ui/Tag';
import { NoteCard } from './NoteCard';
import { useApp } from './AppProvider';

type Detail = NonNullable<Awaited<ReturnType<typeof getSubDetail>>>;
const PAGE = 6;

function Ext({ href }: { href: string }) {
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{href.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a> : <>—</>;
}

export function DetailDrawer({ id, reloadKey, onClose }: { id: number; reloadKey: number; onClose: () => void }) {
  const { run, openEdit, openCancel, openNote } = useApp();
  const [d, setD] = useState<Detail | null>(null);
  const [page, setPage] = useState(1);
  const [confirmDel, setConfirmDel] = useState(false);
  const [adding, setAdding] = useState<{ date: string; price: string } | null>(null);

  useEffect(() => {
    getSubDetail(id).then((r) => (r ? setD(r) : onClose()));
  }, [id, reloadKey, onClose]);

  if (!d) return <Drawer title="订阅详情" onClose={onClose}><div className="empty">加载中…</div></Drawer>;
  const { sub: s, email: e } = d;
  const live = s.kind === 'sub' && s.status === 'active';
  const pages = Math.max(1, Math.ceil(d.payments.length / PAGE));
  const shown = d.payments.slice((page - 1) * PAGE, page * PAGE);
  const total = d.payments.reduce((a, p) => a + p.amountCents, 0);
  const kv = (k: string, v: React.ReactNode, full = false) => (
    <div className={full ? 'full' : ''}><dt>{k}</dt><dd>{v}</dd></div>
  );

  return (
    <Drawer
      title="订阅详情"
      onClose={onClose}
      footer={
        <>
          {confirmDel ? (
            <button className="btn btn-danger-t" style={{ marginRight: 'auto' }} onClick={async () => { if (await run(deleteSubscription(s.id), `${s.name} 已移入回收站`)) onClose(); }}>确认删除</button>
          ) : (
            <button className="btn-text danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDel(true)}>删除</button>
          )}
          {live && <button className="btn" onClick={() => openCancel(s.id)}>取消订阅</button>}
          <button className="btn" onClick={() => openEdit(s.id)}>编辑</button>
          {s.trialEnd ? (
            <button className="btn btn-primary" onClick={() => run(convertTrial(s.id), '已转为正式订阅')}>转为正式订阅</button>
          ) : live && s.nextDate ? (
            <button className="btn btn-primary" onClick={() => run(markRenewed(s.id), (r) => `已记录续费，下次扣费 ${r.nextDate}`)}>标记已续费</button>
          ) : null}
        </>
      }
    >
      <div className="d-top">
        <Logo name={s.name} size="lg" />
        <div>
          <h3>{s.name} <StateTag state={s.state} /></h3>
          <div className="t3">{[s.plan, s.category].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      {s.trialEnd && (
        <div className="trial-box">
          免费试用中，{s.trialEnd}（{diffDays(today(), s.trialEnd)} 天后）开始按 {formatYuan(s.priceCents)}/{CYCLE_UNIT[s.cycle]} 扣费。不需要的话请在此之前取消。
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-sm" onClick={() => openCancel(s.id)}>不要了，去取消</button>
            <button className="btn btn-sm btn-primary" onClick={() => run(convertTrial(s.id), '已转为正式订阅')}>保留，转为正式</button>
          </div>
        </div>
      )}
      <div>
        <div className="sec-t">计费信息</div>
        <dl className="desc">
          {kv('金额', s.kind === 'free' ? '免费' : <><b className="num">{formatYuan(s.priceCents)}</b> {s.kind === 'sub' ? `/ ${CYCLE_UNIT[s.cycle]}` : '一次性'}</>)}
          {kv('计费方式', s.kind === 'free' ? '仅注册' : s.kind === 'once' ? '一次性买断' : CYCLE_LABEL[s.cycle])}
          {s.kind === 'sub' && s.nextDate && kv(s.trialEnd ? '首次扣费' : s.status === 'cancelled' ? '有效期至' : '下次扣费', <><span className="num">{s.nextDate}</span> {weekday(s.nextDate)}</>)}
          {s.kind === 'once' && s.nextDate && kv('购买日期', <span className="num">{s.nextDate}</span>)}
          {s.kind === 'sub' && kv('自动续费', s.autoRenew ? '是' : '否')}
          {s.kind !== 'free' && kv('付费渠道', s.channel || '—')}
          {s.kind !== 'free' && kv('支付方式', s.payName || '—')}
          {kv('使用频率', s.usage ? USAGES[s.usage] : <span className="t3">未标记</span>)}
          {d.priceChanges.length > 0 && kv('价格变动', <div style={{ display: 'grid', gap: 2 }}>{d.priceChanges.slice(0, 5).map((c) => (
            <span key={c.id} className="num">{c.date}　{formatYuan(c.oldCents)} → {formatYuan(c.newCents)} {c.newCents > c.oldCents ? <Tag tone="red">涨价</Tag> : <Tag tone="green">降价</Tag>}</span>
          ))}</div>, true)}
        </dl>
      </div>
      <div>
        <div className="sec-t">账号信息</div>
        <dl className="desc">
          {kv('登录邮箱', e.address)}
          {kv('绑定手机', <span className="num">{e.phone ? maskPhone(e.phone) : '—'}</span>)}
          {kv('辅助邮箱', e.recovery || '—')}
          {kv('登录方式', LOGINS[s.login] || '—')}
          {kv('两步验证', s.mfa === 'none' ? <Tag tone="orange">未开启</Tag> : MFAS[s.mfa] || '—')}
          {kv('服务网址', <Ext href={s.url} />)}
          {kv('管理订阅', <Ext href={s.manageUrl} />, true)}
          {s.note && kv('备注', <span style={{ whiteSpace: 'pre-wrap' }}>{s.note}</span>, true)}
        </dl>
      </div>
      {live && (
        <div>
          <div className="sec-t">如何取消 <span className="t3" style={{ fontWeight: 400 }}>按「{s.channel || '其他'}」自动生成</span></div>
          <ol className="guide">{(GUIDES[s.channel] || GUIDES['其他']).map((x) => <li key={x}>{x}</li>)}</ol>
        </div>
      )}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="sec-t" style={{ margin: 0 }}>备注卡片 <span className="t3" style={{ fontWeight: 400 }}>{d.notes.length}</span></div>
          <button className="btn-text" style={{ fontSize: 13 }} onClick={() => openNote({ targetType: 'sub', targetId: s.id })}>+ 添加卡片</button>
        </div>
        {d.notes.length ? (
          <div className="notes-mini">{d.notes.map((n) => <NoteCard key={n.id} note={n} mini onClick={() => openNote(n)} />)}</div>
        ) : (
          <div className="t3" style={{ fontSize: 13 }}>还没有卡片，可以记下取消方法、发票、共享成员等</div>
        )}
      </div>
      {s.kind !== 'free' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="sec-t" style={{ margin: 0 }}>付费记录 <span className="t3" style={{ fontWeight: 400 }}>累计 {formatYuan(total)} · {d.payments.length} 笔</span></div>
            <button className="btn-text" style={{ fontSize: 13 }} onClick={() => setAdding({ date: today(), price: String(s.priceCents / 100) })}>+ 补记一笔</button>
          </div>
          {adding && (
            <form className="inline-add" onSubmit={async (ev) => { ev.preventDefault(); if (await run(addPayment(s.id, adding.date, adding.price), '已添加付费记录')) setAdding(null); }}>
              <input className="inp" type="date" aria-label="付费日期" value={adding.date} onChange={(ev) => setAdding({ ...adding, date: ev.target.value })} required />
              <div className="affix"><span>¥</span><input className="inp num" type="number" step="0.01" min="0" aria-label="金额" value={adding.price} onChange={(ev) => setAdding({ ...adding, price: ev.target.value })} required /></div>
              <button className="btn btn-primary btn-sm">添加</button>
              <button type="button" className="btn btn-sm" onClick={() => setAdding(null)}>取消</button>
            </form>
          )}
          <div style={{ border: '1px solid var(--divider)', borderRadius: 6, overflow: 'hidden' }}>
            <table className="tbl compact">
              <thead><tr><th>日期</th><th>说明</th><th className="r">金额</th><th aria-label="操作" /></tr></thead>
              <tbody>
                {shown.length ? shown.map((p) => (
                  <tr key={p.id}>
                    <td className="num">{p.date}</td>
                    <td className="t3">{p.note || (p.auto ? '自动续费' : '')}</td>
                    <td className="r num">{formatYuan(p.amountCents)}</td>
                    <td className="r"><button className="btn-text danger" style={{ fontSize: 12 }} onClick={() => run(deletePayment(p.id), '已删除这笔记录')}>删除</button></td>
                  </tr>
                )) : <tr><td colSpan={4} className="t3">暂无</td></tr>}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="pager" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="上一页">‹</button>
              <span className="t3" style={{ fontSize: 13 }}>{page} / {pages}</span>
              <button disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="下一页">›</button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
