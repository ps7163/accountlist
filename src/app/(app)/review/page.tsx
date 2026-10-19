import Link from 'next/link';
import { formatYuan } from '@/lib/billing';
import { USAGES } from '@/lib/constants';
import { listSubs } from '@/lib/queries';
import { buildReview } from '@/lib/review';
import { getSetting } from '@/lib/settings';
import { paginate, param, type Search } from '@/lib/paging';
import { Icon, Logo } from '@/components/icons';
import { Tag } from '@/components/ui/Tag';
import { PagerNav } from '@/components/ui/Pager';
import { OpenLink } from '@/components/app/Opener';
import { FinishReview, UsageSelect, WasteActions } from '@/components/app/ReviewUI';

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const subs = listSubs();
  const r = buildReview(subs);
  const last = getSetting('last_review');
  const monthly = subs.reduce((a, s) => a + s.monthlyCents, 0);
  const U = paginate(r.unmarked, param(sp, 'up'), '', 8);
  const name = (s: (typeof subs)[number]) => (
    <div className="svc"><Logo name={s.name} /><div><OpenLink id={s.id}>{s.name} <span className="t3">{s.plan}</span></OpenLink><div className="sub">{s.emailAddress}</div></div></div>
  );
  const nothing = !r.waste.length && !r.unmarked.length && !r.overlaps.length && !r.duplicates.length && !r.increases.length;

  return (
    <>
      <section className="card sec-sum">
        <span className="shield-big" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Icon name="pulse" /></span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{r.yearlySavingCents ? <>取消用得少的订阅，一年可省 <span className="num" style={{ color: 'var(--green-text)' }}>{formatYuan(r.yearlySavingCents, 0)}</span></> : '订阅体检'}</div>
          <div className="t3">每 90 天体检一次：找出花得多用得少、重复和涨价的订阅。上次体检：{last ?? '从未'}</div>
        </div>
        <div className="sum-n"><b className="num">{formatYuan(monthly, 0)}</b><span>每月支出</span></div>
        <div className="sum-n"><b className="num" style={{ color: 'var(--orange)' }}>{r.waste.length}</b><span>用得少</span></div>
        <div className="sum-n"><b className="num" style={{ color: 'var(--primary)' }}>{r.unmarked.length}</b><span>未标记</span></div>
        <FinishReview />
      </section>

      {nothing && <section className="card"><div className="empty">没有发现需要关注的订阅。给订阅标记「使用频率」后，这里会给出更准确的建议。</div></section>}

      {r.waste.length > 0 && (
        <section className="card">
          <div className="card-h"><h2>花得多、用得少</h2><span className="ex">标记为「每月偶尔用」或「几乎不用」的付费订阅</span></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>服务</th><th>使用频率</th><th className="r">每月</th><th className="r">一年</th><th>下次扣费</th><th>操作</th></tr></thead>
            <tbody>{r.waste.map((s) => (
              <tr key={s.id}>
                <td>{name(s)}</td>
                <td><Tag tone={s.usage === 'rarely' ? 'red' : 'orange'}>{USAGES[s.usage]}</Tag></td>
                <td className="r num">{formatYuan(s.monthlyCents, 0)}</td>
                <td className="r num">{formatYuan(s.monthlyCents * 12, 0)}</td>
                <td className="num t2">{s.nextDate ?? '—'}</td>
                <td><WasteActions id={s.id} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      {r.unmarked.length > 0 && (
        <section className="card">
          <div className="card-h"><h2>标记使用频率 <span className="t3" style={{ fontWeight: 400, fontSize: 14 }}>{r.unmarked.length}</span></h2><span className="ex">花一分钟标一下，体检才知道哪些值得留</span></div>
          <div className="tbl-wrap"><table className="tbl compact">
            <thead><tr><th>服务</th><th className="r">每月</th><th>使用频率</th></tr></thead>
            <tbody>{U.items.map((s) => (
              <tr key={s.id}><td>{name(s)}</td><td className="r num">{formatYuan(s.monthlyCents, 0)}</td><td><UsageSelect id={s.id} value={s.usage} /></td></tr>
            ))}</tbody>
          </table></div>
          {U.pages > 1 && <div className="tbl-foot"><span>共 {U.total} 个</span><PagerNav p={U} path="/review" sp={sp} pageKey="up" /></div>}
        </section>
      )}

      {(r.duplicates.length > 0 || r.overlaps.length > 0) && (
        <section className="card">
          <div className="card-h"><h2>重复与同类订阅</h2><span className="ex">同一个服务付了多份，或同类服务订了好几个</span></div>
          <div className="card-b" style={{ display: 'grid', gap: 12 }}>
            {r.duplicates.map((d) => (
              <div key={d.name} className="group-box warn">
                <div className="nm"><Tag tone="red">重复</Tag> {d.name} 在 {new Set(d.subs.map((s) => s.emailId)).size} 个邮箱下都在付费</div>
                <div className="group-list">{d.subs.map((s) => <span key={s.id}><OpenLink id={s.id}>{s.emailAddress}</OpenLink> · {formatYuan(s.priceCents, 0)}</span>)}</div>
              </div>
            ))}
            {r.overlaps.map((g) => (
              <div key={g.category} className="group-box">
                <div className="nm"><Tag tone="blue">{g.category}</Tag> 有 {g.subs.length} 个在付费，合计每月 <b className="num">{formatYuan(g.monthlyCents, 0)}</b></div>
                <div className="group-list">{g.subs.map((s) => <span key={s.id}><Logo name={s.name} size="xs" /> <OpenLink id={s.id}>{s.name}</OpenLink> {formatYuan(s.monthlyCents, 0)}/月{s.usage ? ` · ${USAGES[s.usage]}` : ''}</span>)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {r.increases.length > 0 && (
        <section className="card">
          <div className="card-h"><h2>最近涨价</h2><span className="ex">近 180 天价格上调的订阅</span></div>
          <div className="tbl-wrap"><table className="tbl compact">
            <thead><tr><th>服务</th><th>日期</th><th className="r">原价</th><th className="r">现价</th><th className="r">涨幅</th></tr></thead>
            <tbody>{r.increases.map((s) => (
              <tr key={s.id}>
                <td>{name(s)}</td><td className="num t2">{s.lastChange!.date}</td>
                <td className="r num t2">{formatYuan(s.lastChange!.oldCents)}</td><td className="r num">{formatYuan(s.lastChange!.newCents)}</td>
                <td className="r"><Tag tone="red">+{(((s.lastChange!.newCents - s.lastChange!.oldCents) / s.lastChange!.oldCents) * 100).toFixed(0)}%</Tag></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      <section className="card">
        <div className="card-h"><h2>资料完整度</h2><span className="ex">资料越全，提醒和取消指引越准</span></div>
        <div className="card-b complete">
          {([['manage', '没填「管理订阅链接」', '取消时找不到入口'], ['pay', '没指定支付方式', '换卡时不知道要改哪些'], ['channel', '没填付费渠道', '无法生成取消步骤']] as const).map(([k, t, d]) => (
            <Link key={k} href={`/subscriptions?missing=${k}`} className={`complete-i ${r.missing[k] ? '' : 'done'}`}>
              <b className="num">{r.missing[k]}</b><span>{t}</span><span className="t3">{r.missing[k] ? d : '已完善'}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
