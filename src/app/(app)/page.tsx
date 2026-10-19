import Link from 'next/link';
import { CYCLE_UNIT, PER_MONTH, formatYuan, projectedDates, today, weekday } from '@/lib/billing';
import { expiringPayMethods, listEmails, listPayMethods, listPayments, listSubs } from '@/lib/queries';
import { getPrefs, getSetting } from '@/lib/settings';
import { reviewDue } from '@/lib/review';
import { hrefWith, paginate, param, type Search } from '@/lib/paging';
import { Icon, Logo, type IconName } from '@/components/icons';
import { StateTag, Tag } from '@/components/ui/Tag';
import { PagerNav } from '@/components/ui/Pager';
import { Donut, TrendChart, type MonthTotal } from '@/components/charts';
import { NewSubButton, OpenLink, Opener } from '@/components/app/Opener';
import { ClearSnoozes, TodoActions } from '@/components/app/TodoActions';

const TABS = ['todo', 'up', 'spend', 'trial', 'mail'] as const;

export default async function Workbench({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(param(sp, 'tab')) ? param(sp, 'tab') : 'todo';
  const t = today();
  const prefs = getPrefs();
  const subs = listSubs();
  const emails = listEmails();
  const pays = listPayments();

  if (!emails.length && !subs.length) return <Welcome />;

  const alerts = subs.filter((s) => s.state.alert).sort((a, b) => (a.state.days ?? 0) - (b.state.days ?? 0));
  const payAlerts = expiringPayMethods(listPayMethods(), t);
  const snoozed = subs.filter((s) => s.snoozeUntil && s.snoozeUntil > t && s.status === 'active');
  const live = subs.filter((s) => s.kind === 'sub' && s.status === 'active');
  const trials = live.filter((s) => s.trialEnd);
  const monthly = subs.reduce((a, s) => a + s.monthlyCents, 0);
  const year = t.slice(0, 4);
  const spentYear = pays.filter((p) => p.date.startsWith(year) && p.date <= t).reduce((a, p) => a + p.amountCents, 0);
  const in30 = (d: string | null) => !!d && d >= t && d <= projectedEnd(t, 30);
  const upcoming = live.filter((s) => in30(s.trialEnd ?? s.nextDate)).sort((a, b) => (a.trialEnd ?? a.nextDate)!.localeCompare((b.trialEnd ?? b.nextDate)!));

  // 近 12 个月
  const [cy, cm] = [Number(t.slice(0, 4)), Number(t.slice(5, 7))];
  const months: MonthTotal[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(cy, cm - 12 + i, 1));
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, key = `${y}-${String(m).padStart(2, '0')}`;
    const paid = pays.filter((p) => p.date.startsWith(key) && p.date <= t).reduce((a, p) => a + p.amountCents, 0);
    let due = 0;
    if (i === 11) for (const s of live) due += projectedDates(s, `${key}-01`, `${key}-31`, t).length * s.priceCents;
    return { y, m, paid, due };
  });
  const cur = months[11], prev = months[10];

  const byCat = new Map<string, number>();
  for (const s of subs) if (s.monthlyCents) byCat.set(s.category, (byCat.get(s.category) ?? 0) + s.monthlyCents);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const byMail = emails.map((e) => {
    const mine = subs.filter((s) => s.emailId === e.id);
    return { e, n: mine.length, m: mine.reduce((a, s) => a + s.monthlyCents, 0) };
  });
  const mMax = Math.max(1, ...byMail.map((x) => x.m));

  type TodoItem = { kind: 'sub'; s: (typeof subs)[number] } | { kind: 'pay'; p: (typeof payAlerts)[number] } | { kind: 'review' } | { kind: 'budget' };
  const overBudget = prefs.budgetCents > 0 && monthly > prefs.budgetCents;
  const todos: TodoItem[] = [
    ...(overBudget ? [{ kind: 'budget' as const }] : []),
    ...alerts.map((s) => ({ kind: 'sub' as const, s })),
    ...payAlerts.map((p) => ({ kind: 'pay' as const, p })),
    ...(reviewDue(getSetting('last_review'), subs, t) ? [{ kind: 'review' as const }] : []),
  ];
  const tabs: [string, string, number | null][] = [['todo', '待办', todos.length], ['up', '即将扣费', upcoming.length], ['spend', '支出分析', null], ['trial', '试用中', trials.length], ['mail', '按邮箱', null]];
  const pg = param(sp, 'p');
  const PT = paginate(todos, pg, '', 5), PU = paginate(upcoming, pg, '', 5), PR = paginate(trials, pg, '', 5), PM = paginate(byMail, pg, '', 5);

  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Shanghai' }).format(new Date()));
  const greet = h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好';
  const kpi = (icon: IconName, tone: string, label: string, value: React.ReactNode, sub: React.ReactNode) => (
    <div className="card kpi">
      <div className="kpi-top"><span className="kpi-l">{label}</span><span className="kpi-ic" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})` }}><Icon name={icon} /></span></div>
      <div className="kpi-v num">{value}</div>
      <div className="kpi-s">{sub}</div>
    </div>
  );

  return (
    <>
      <div className="hello">
        <h1>{greet}，{prefs.displayName}</h1>
        <p>今天是 {Number(t.slice(0, 4))} 年 {Number(t.slice(5, 7))} 月 {Number(t.slice(8, 10))} 日 {weekday(t)}，本月还有 <b className="num">{formatYuan(cur.due)}</b> 待扣费</p>
      </div>
      {todos.length > 0 && tab !== 'todo' && (
        <div className="alert">
          <Icon name="warn" />
          <div className="grow">
            <b>你有 {todos.length} 项待办：</b>
            {[overBudget && '每月支出超出预算', alerts.length && `${alerts.length} 个订阅即将到期或已过期`, payAlerts.length && `${payAlerts.length} 个支付方式即将过期`].filter(Boolean).join('，') || '该做订阅体检了'}
          </div>
          <Link className="btn-text" href="/?tab=todo">去处理</Link>
        </div>
      )}
      <section className="kpis">
        {kpi('wallet', overBudget ? 'red' : 'blue', '每月固定支出', formatYuan(monthly, 0), prefs.budgetCents ? (
          <span style={{ display: 'grid', gap: 4 }}>
            <span className="budget-bar"><i style={{ width: `${Math.min(100, (monthly / prefs.budgetCents) * 100).toFixed(0)}%`, background: overBudget ? 'var(--red)' : monthly / prefs.budgetCents > 0.85 ? 'var(--orange)' : 'var(--c1)' }} /></span>
            <span style={overBudget ? { color: 'var(--red-text)' } : undefined}>预算 {formatYuan(prefs.budgetCents, 0)} · 已用 {((monthly / prefs.budgetCents) * 100).toFixed(0)}%</span>
          </span>
        ) : `折合每天 ${formatYuan(monthly / 30)}`)}
        {kpi('bill', 'green', `${year} 年已支出`, formatYuan(spentYear, 0), `上月 ${formatYuan(prev.paid, 0)} · 本月已付 ${formatYuan(cur.paid, 0)}`)}
        {kpi('trend', 'orange', '全年预计支出', formatYuan(monthly * 12, 0), '按当前在用订阅推算')}
        {kpi('layers', 'purple', '在用订阅', <>{live.length - trials.length}<small> 个</small></>, `试用 ${trials.length} 个 · 仅注册 ${subs.filter((s) => s.kind === 'free').length} 个`)}
      </section>

      <section className="card">
        <div className="tabs" role="tablist">
          {tabs.map(([k, label, n]) => (
            <Link key={k} className="tab" role="tab" aria-selected={tab === k} href={k === 'todo' ? '/' : `/?tab=${k}`} scroll={false}>
              {label}{n !== null && <span className="n">{n}</span>}
            </Link>
          ))}
        </div>

        {tab === 'todo' && (
          <div className="card-b" style={{ paddingTop: 4 }}>
            {PT.items.map((it) =>
              it.kind === 'review' ? (
                <div className="todo" key="review">
                  <span className="pay-ic lg"><Icon name="pulse" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">该做订阅体检了 <Tag tone="blue">建议</Tag></div>
                    <div className="t3 ell" style={{ fontSize: 12 }}>找出花得多用得少、重复和涨价的订阅，每 90 天一次</div>
                  </div>
                  <div className="todo-a"><Link className="btn btn-sm btn-primary" href="/review">去体检</Link></div>
                </div>
              ) : it.kind === 'budget' ? (
                <div className="todo" key="budget">
                  <span className="pay-ic lg" style={{ color: 'var(--red)' }}><Icon name="wallet" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">每月支出超出预算 <Tag tone="red">超支 {formatYuan(monthly - prefs.budgetCents, 0)}</Tag></div>
                    <div className="t3 ell" style={{ fontSize: 12 }}>当前每月 {formatYuan(monthly, 0)}，预算 {formatYuan(prefs.budgetCents, 0)}</div>
                  </div>
                  <div className="todo-a"><Link className="btn btn-sm" href="/review">看看哪些可以省</Link></div>
                </div>
              ) : it.kind === 'pay' ? (
                <div className="todo" key={`p${it.p.id}`}>
                  <span className="pay-ic lg"><Icon name="card" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{it.p.name} 即将过期 <Tag tone="orange">支付方式</Tag></div>
                    <div className="t3 ell" style={{ fontSize: 12 }}>{it.p.expireMonth} 到期 · 绑定 {subs.filter((s) => s.payMethodId === it.p.id).length} 个订阅，换卡后需要逐个更新</div>
                  </div>
                  <div className="todo-a"><Link className="btn btn-sm" href={`/subscriptions?pay=${it.p.id}`}>查看订阅</Link></div>
                </div>
              ) : (
                <div className="todo" key={`s${it.s.id}`}>
                  <Logo name={it.s.name} size="md" />
                  <div style={{ minWidth: 0 }}>
                    <div className="nm"><OpenLink id={it.s.id}>{it.s.name} {it.s.plan}</OpenLink><StateTag state={it.s.state} /></div>
                    <div className="t3 ell" style={{ fontSize: 12 }}>
                      {it.s.trialEnd ? `${it.s.trialEnd} 试用结束，之后 ${formatYuan(it.s.priceCents)}/${CYCLE_UNIT[it.s.cycle]}`
                        : (it.s.state.days ?? 0) < 0 ? `${it.s.nextDate} 已到期，没有开启自动续费`
                        : `${it.s.nextDate} 扣费 ${formatYuan(it.s.priceCents)} · ${it.s.channel || '未填渠道'}`}
                    </div>
                  </div>
                  <TodoActions id={it.s.id} trial={!!it.s.trialEnd} />
                </div>
              ),
            )}
            {!todos.length && <div className="empty"><Icon name="ok" /><div style={{ marginTop: 6 }}>待办都处理完了</div></div>}
            <div className="tab-foot">
              <span>{snoozed.length ? <>已稍后提醒 {snoozed.length} 项：{snoozed.map((s) => s.name).join('、')} <ClearSnoozes /></> : '处理完的待办会自动消失；不想马上处理可以选「稍后提醒」'}</span>
              <PagerNav p={PT} path="/" sp={sp} pageKey="p" />
            </div>
          </div>
        )}

        {tab === 'up' && (
          <div className="card-b" style={{ paddingTop: 8 }}>
            {PU.items.map((s) => {
              const d = (s.trialEnd ?? s.nextDate)!;
              return (
                <Opener key={s.id} id={s.id} className="up">
                  <div className="dbox"><b className="num">{Number(d.slice(8, 10))}</b><span>{Number(d.slice(5, 7))}月 {weekday(d)}</span></div>
                  <div className="up-m"><Logo name={s.name} size="md" /><div style={{ minWidth: 0 }}><div className="nm ell">{s.name} <span className="t3">{s.plan}</span></div><div className="t3 ell" style={{ fontSize: 12 }}>{s.emailAddress} · {s.channel || '未填渠道'}</div></div></div>
                  <div className="up-r"><b className="num">{formatYuan(s.priceCents)}</b><StateTag state={s.state} /></div>
                </Opener>
              );
            })}
            {!upcoming.length && <div className="empty">30 天内没有扣费</div>}
            <div className="tab-foot">
              <span>未来 30 天共 {upcoming.length} 笔，合计 <b className="num">{formatYuan(upcoming.reduce((a, s) => a + s.priceCents, 0))}</b></span>
              <div className="pager-wrap"><PagerNav p={PU} path="/" sp={sp} pageKey="p" /><Link className="btn-text" href="/calendar">查看扣费日历</Link></div>
            </div>
          </div>
        )}

        {tab === 'spend' && (
          <div className="spend">
            <div>
              <div className="sub-h"><b>近 12 个月支出</b><span className="legend-s"><span><i style={{ background: 'var(--c1)' }} />已支出</span><span><i style={{ background: 'var(--c1-soft)' }} />本月待扣</span></span></div>
              <div className="chart"><TrendChart data={months} /></div>
            </div>
            <div>
              <div className="sub-h"><b>月支出构成</b><span className="t3" style={{ fontSize: 12 }}>按分类</span></div>
              <div className="donut-wrap">
                <Donut cats={cats} total={monthly} />
                <div className="dl">
                  {cats.map(([c, v], i) => (
                    <div className="dl-row" key={c}><i style={{ background: `var(--c${Math.min(i + 1, 6)})` }} /><span>{c}</span><span className="num t3">{((v / monthly) * 100).toFixed(0)}%</span><b className="num">{formatYuan(v, 0)}</b></div>
                  ))}
                  {!cats.length && <span className="t3">暂无在用的付费订阅</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'trial' && (
          <div className="card-b" style={{ paddingTop: 8 }}>
            {PR.items.map((s) => (
              <Opener key={s.id} id={s.id} className="li">
                <Logo name={s.name} size="md" />
                <div className="grow"><div className="nm">{s.name} {s.plan}</div><div className="t3" style={{ fontSize: 12 }}>{s.emailAddress} · {s.trialEnd} 起 {formatYuan(s.priceCents)}/{CYCLE_UNIT[s.cycle]}</div></div>
                <StateTag state={s.state} />
              </Opener>
            ))}
            {!trials.length && <div className="empty">暂无试用中的服务</div>}
            <div className="tab-foot">
              <span>全部转正后每月增加 <b className="num">{formatYuan(trials.reduce((a, s) => a + s.priceCents * PER_MONTH[s.cycle], 0), 0)}</b></span>
              <PagerNav p={PR} path="/" sp={sp} pageKey="p" />
            </div>
          </div>
        )}

        {tab === 'mail' && (
          <div className="card-b" style={{ paddingTop: 8 }}>
            {PM.items.map((x) => (
              <Link key={x.e.id} className="li" href={`/subscriptions?email=${x.e.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <Logo name={x.e.provider} size="md" />
                <div className="grow">
                  <div className="nm ell" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className="ell">{x.e.address}</span><b className="num" style={{ fontWeight: 500 }}>{formatYuan(x.m, 0)}<span className="t3" style={{ fontWeight: 400 }}>/月</span></b></div>
                  <div className="mbar"><i style={{ width: `${((x.m / mMax) * 100).toFixed(0)}%` }} /></div>
                  <div className="t3" style={{ fontSize: 12 }}>{x.n} 个服务{x.e.note ? ` · ${x.e.note}` : ''}</div>
                </div>
              </Link>
            ))}
            <div className="tab-foot">
              <span>{emails.length} 个邮箱</span>
              <div className="pager-wrap"><PagerNav p={PM} path="/" sp={sp} pageKey="p" /><Link className="btn-text" href="/emails">管理邮箱</Link></div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function projectedEnd(t: string, days: number): string {
  const d = new Date(t + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function Welcome() {
  return (
    <section className="card" style={{ padding: '40px 32px', display: 'grid', gap: 16, justifyItems: 'start' }}>
      <div style={{ fontSize: 22, fontWeight: 600 }}>欢迎使用账号簿</div>
      <p className="t2" style={{ margin: 0, maxWidth: 560 }}>三步开始：先添加你的邮箱，再添加用这些邮箱注册的服务和订阅。数据多的话，可以下载 Excel 模板一次导入。</p>
      <ol className="guide" style={{ fontSize: 14 }}>
        <li>添加邮箱（可以记录绑定手机和辅助邮箱）</li>
        <li>添加订阅：价格、周期、下次扣费日、付费渠道</li>
        <li>到期前会在工作台提醒你，也可以同步到手机日历</li>
      </ol>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" href="/emails?new=1"><Icon name="mail" />添加邮箱</Link>
        <NewSubButton className="btn"><Icon name="plus" />添加订阅</NewSubButton>
        <Link className="btn" href="/settings#data"><Icon name="up" />从 Excel 导入</Link>
      </div>
    </section>
  );
}
