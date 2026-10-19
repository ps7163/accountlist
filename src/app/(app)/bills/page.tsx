import { formatYuan, today } from '@/lib/billing';
import { listPayments } from '@/lib/queries';
import { paginate, param, type Search } from '@/lib/paging';
import { Icon, Logo } from '@/components/icons';
import { Pager } from '@/components/ui/Pager';
import { FilterSelect } from '@/components/app/Filters';
import { Opener } from '@/components/app/Opener';

export default async function BillsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const t = today();
  const all = listPayments().filter((p) => p.date <= t);
  const years = [...new Set(all.map((p) => p.date.slice(0, 4)))].sort().reverse();
  const year = years.includes(param(sp, 'year')) ? param(sp, 'year') : t.slice(0, 4);
  const rows = all.filter((p) => p.date.startsWith(year));
  const total = rows.reduce((a, p) => a + p.amountCents, 0);
  const months = year === t.slice(0, 4) ? Number(t.slice(5, 7)) : 12;
  const byName = new Map<string, number>();
  for (const r of rows) byName.set(r.name, (byName.get(r.name) ?? 0) + r.amountCents);
  const top = [...byName.entries()].sort((a, b) => b[1] - a[1])[0];
  const P = paginate(rows, param(sp, 'page'), param(sp, 'size'));
  return (
    <section className="card">
      <div className="card-h">
        <h2>付费记录</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <FilterSelect name="year" label={`${t.slice(0, 4)} 年`} options={years.filter((y) => y !== t.slice(0, 4)).map((y) => [y, `${y} 年`])} />
          <a className="btn btn-sm" href="/api/export?format=xlsx"><Icon name="down" />导出</a>
        </div>
      </div>
      <div className="stats" style={{ borderBottom: '1px solid var(--divider)' }}>
        <div className="stat"><div className="l">{year} 年合计</div><div className="v">{formatYuan(total, 0)}</div></div>
        <div className="stat"><div className="l">笔数</div><div className="v">{rows.length}<small>笔</small></div></div>
        <div className="stat"><div className="l">月均</div><div className="v">{formatYuan(total / months, 0)}</div></div>
        <div className="stat"><div className="l">花费最多</div><div className="v ell">{top ? <>{top[0]}<small>{formatYuan(top[1], 0)}</small></> : '—'}</div></div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl compact">
          <thead><tr><th>日期</th><th>服务</th><th>登录邮箱</th><th>付费渠道</th><th>支付方式</th><th>说明</th><th className="r">金额</th></tr></thead>
          <tbody>
            {P.items.map((p) => (
              <Opener key={p.id} id={p.subscriptionId} as="tr" className="row">
                <td className="num">{p.date}</td>
                <td><div className="svc"><Logo name={p.name} />{p.name} <span className="t3">{p.plan}</span></div></td>
                <td className="t2">{p.emailAddress}</td>
                <td className="t2">{p.channel || '—'}</td>
                <td className="t2">{p.payName || '—'}</td>
                <td className="t3">{p.note}</td>
                <td className="r num">{formatYuan(p.amountCents)}</td>
              </Opener>
            ))}
            {!rows.length && <tr><td colSpan={7} className="empty">这一年没有付费记录</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager p={P} path="/bills" sp={sp} left={<>共 {rows.length} 条 · 合计 <b className="num" style={{ color: 'var(--text)' }}>{formatYuan(total)}</b></>} />
    </section>
  );
}
