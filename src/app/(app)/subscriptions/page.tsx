import Link from 'next/link';
import { listEmails, listPayMethods, listSubs, type SubView } from '@/lib/queries';
import { CATEGORIES, CHANNELS } from '@/lib/constants';
import { hrefWith, paginate, param, type Search } from '@/lib/paging';
import { Icon } from '@/components/icons';
import { Pager } from '@/components/ui/Pager';
import { FilterSelect, SearchBox } from '@/components/app/Filters';
import { SubTable } from '@/components/app/SubTable';
import { ImportButton } from '@/components/app/ImportExport';
import { AutoOpenNew } from '@/components/app/Opener';

const GROUPS: [string, string][] = [['all', '全部'], ['soon', '需处理'], ['active', '使用中'], ['trial', '试用中'], ['ended', '已取消/过期'], ['once', '买断'], ['free', '仅注册']];
const inGroup = (s: SubView, g: string) => g === 'all' || (g === 'soon' ? s.state.alert : s.state.group === g);
const ORDER: Record<string, number> = { active: 0, trial: 1, once: 2, ended: 3, free: 4 };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = param(sp, 'q').toLowerCase();
  const email = Number(param(sp, 'email')) || 0;
  const channel = param(sp, 'channel');
  const cat = param(sp, 'cat');
  const pay = Number(param(sp, 'pay')) || 0;
  const mfa = param(sp, 'mfa');
  const missing = param(sp, 'missing');
  const paidLive = (s: SubView) => s.kind !== 'free' && s.status === 'active';
  const group = GROUPS.some(([k]) => k === param(sp, 'group')) ? param(sp, 'group') : 'all';
  const emails = listEmails();
  const payMethods = listPayMethods();

  const base = listSubs().filter(
    (s) =>
      (!email || s.emailId === email) &&
      (!channel || s.channel === channel) &&
      (!cat || s.category === cat) &&
      (!pay || s.payMethodId === pay) &&
      (!mfa || s.mfa === mfa) &&
      (!missing || (paidLive(s) && (missing === 'manage' ? !s.manageUrl && s.kind === 'sub' : missing === 'pay' ? !s.payMethodId : missing === 'channel' ? !s.channel : true))) &&
      (!q || [s.name, s.plan, s.payName, s.note, s.channel, s.emailAddress, s.category].join(' ').toLowerCase().includes(q)),
  );
  const rows = base
    .filter((s) => inGroup(s, group))
    .sort((a, b) => ORDER[a.state.group] - ORDER[b.state.group] || (a.trialEnd ?? a.nextDate ?? '9999').localeCompare(b.trialEnd ?? b.nextDate ?? '9999'));
  const P = paginate(rows, param(sp, 'page'), param(sp, 'size'));
  const payName = pay ? payMethods.find((p) => p.id === pay)?.name : '';

  return (
    <section className="card">
      <div className="tabs" role="tablist">
        {GROUPS.map(([k, t]) => (
          <Link key={k} className="tab" role="tab" aria-selected={group === k} href={hrefWith('/subscriptions', sp, { group: k === 'all' ? null : k, page: null })} scroll={false}>
            {t}<span className="n">{base.filter((s) => inGroup(s, k)).length}</span>
          </Link>
        ))}
      </div>
      <div className="toolbar">
        <SearchBox placeholder="搜索服务、档位、支付方式、备注" />
        <FilterSelect name="email" label="全部邮箱" options={emails.map((e) => [String(e.id), e.address])} />
        <FilterSelect name="channel" label="全部渠道" options={CHANNELS.map((c) => [c, c])} />
        <FilterSelect name="cat" label="全部分类" options={CATEGORIES.map((c) => [c, c])} />
        <span className="sp" />
        <ImportButton />
        <a className="btn" href="/api/export?format=xlsx"><Icon name="down" />导出</a>
      </div>
      {(payName || mfa || missing) && (
        <div className="batch" style={{ background: 'var(--fill)', color: 'var(--text-2)' }}>
          {payName && <>正在查看绑定「{payName}」的订阅</>}
          {mfa === 'none' && <>正在查看未开启两步验证的订阅</>}
          {missing && <>正在查看{{ manage: '没填管理订阅链接', pay: '没指定支付方式', channel: '没填付费渠道' }[missing] ?? ''}的订阅，点击行可以补充</>}
          <Link className="btn-text" href={hrefWith('/subscriptions', sp, { pay: null, mfa: null, missing: null, page: null })}>清除</Link>
        </div>
      )}
      {rows.length ? <SubTable rows={P.items} /> : <div className="empty">{base.length || group !== 'all' ? '没有符合条件的订阅' : '还没有订阅，点右上角「新建订阅」添加第一个'}</div>}
      <Pager p={P} path="/subscriptions" sp={sp} />
      <AutoOpenNew />
    </section>
  );
}
