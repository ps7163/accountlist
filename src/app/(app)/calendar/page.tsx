import Link from 'next/link';
import { daysInMonth, formatYuan, projectedDates, today } from '@/lib/billing';
import { listPayments, listSubs } from '@/lib/queries';
import { param, type Search } from '@/lib/paging';
import { Icon, Logo } from '@/components/icons';
import { Tag } from '@/components/ui/Tag';
import { OpenChip } from '@/components/app/OpenChip';

interface Ev {
  id: number;
  name: string;
  amount: number;
  type: 'paid' | 'due' | 'trial';
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const t = today();
  const m = /^\d{4}-\d{2}$/.test(param(sp, 'm')) ? param(sp, 'm') : t.slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const dim = daysInMonth(y, mo);
  const from = `${m}-01`, to = `${m}-${String(dim).padStart(2, '0')}`;
  const shift = (k: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + k, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const ev = new Map<number, Ev[]>();
  const add = (date: string, e: Ev) => {
    const d = Number(date.slice(8, 10));
    ev.set(d, [...(ev.get(d) ?? []), e]);
  };
  for (const p of listPayments()) if (p.date >= from && p.date <= to) add(p.date, { id: p.subscriptionId, name: p.name, amount: p.amountCents, type: 'paid' });
  for (const s of listSubs()) {
    for (const d of projectedDates(s, from, to, t)) add(d, { id: s.id, name: s.name, amount: s.priceCents, type: s.trialEnd === d ? 'trial' : 'due' });
  }
  const all = [...ev.values()].flat();
  const paid = all.filter((e) => e.type === 'paid').reduce((a, e) => a + e.amount, 0);
  const due = all.filter((e) => e.type !== 'paid').reduce((a, e) => a + e.amount, 0);
  const offset = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
  const tail = (7 - ((offset + dim) % 7)) % 7;

  return (
    <section className="card">
      <div className="card-h">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link className="icon-btn" href={`/calendar?m=${shift(-1)}`} aria-label="上个月"><Icon name="left" /></Link>
          <h2 className="num">{y} 年 {mo} 月</h2>
          <Link className="icon-btn" href={`/calendar?m=${shift(1)}`} aria-label="下个月"><Icon name="right" /></Link>
          <Link className="btn btn-sm" href="/calendar">今天</Link>
        </div>
        <span className="ex" style={{ display: 'flex', gap: 12 }}>
          <span>已扣 <b className="num" style={{ color: 'var(--text)' }}>{formatYuan(paid)}</b></span>
          <span>待扣 <b className="num" style={{ color: 'var(--primary)' }}>{formatYuan(due)}</b></span>
        </span>
      </div>
      <div className="card-b">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}><Tag tone="blue">待扣费</Tag><Tag tone="gray">已扣费</Tag><Tag tone="purple">试用转正</Tag></div>
        <div className="cal">
          {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((w) => <div key={w} className="wd">{w}</div>)}
          {Array.from({ length: offset }, (_, i) => <div key={`o${i}`} className="day out" />)}
          {Array.from({ length: dim }, (_, i) => {
            const d = i + 1, es = ev.get(d) ?? [];
            const isToday = `${m}-${String(d).padStart(2, '0')}` === t;
            return (
              <div key={d} className={`day ${isToday ? 'today' : ''}`}>
                <span className="n num">{d}</span>
                {es.slice(0, 3).map((e, k) => (
                  <OpenChip key={k} id={e.id} className={`chip ${e.type === 'due' ? '' : e.type}`} title={`${e.name} ${formatYuan(e.amount)}`}>
                    <Logo name={e.name} size="xs" /><span>{e.name} {formatYuan(e.amount, 0)}</span>
                  </OpenChip>
                ))}
                {es.length > 3 && <span className="more">还有 {es.length - 3} 笔</span>}
              </div>
            );
          })}
          {Array.from({ length: tail }, (_, i) => <div key={`t${i}`} className="day out" />)}
        </div>
      </div>
    </section>
  );
}
