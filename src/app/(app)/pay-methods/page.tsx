import Link from 'next/link';
import { formatYuan } from '@/lib/billing';
import { expiringPayMethods, listPayMethods, listSubs } from '@/lib/queries';
import { hrefWith, paginate, param, type Search } from '@/lib/paging';
import { Icon, Logo } from '@/components/icons';
import { Tag } from '@/components/ui/Tag';
import { Pager } from '@/components/ui/Pager';
import { PayDialogs } from '@/components/app/PayUI';

export default async function PayMethodsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const list = listPayMethods();
  const subs = listSubs();
  const expiring = new Set(expiringPayMethods(list).map((p) => p.id));
  const bound = (id: number) => subs.filter((s) => s.payMethodId === id && s.kind !== 'free');
  const P = paginate(list, param(sp, 'page'), param(sp, 'size'));
  return (
    <>
      {list.filter((p) => expiring.has(p.id)).map((p) => {
        const b = bound(p.id).filter((s) => s.status === 'active');
        return (
          <div className="alert" key={p.id}>
            <Icon name="warn" />
            <div className="grow"><b>{p.name} 将于 {p.expireMonth} 到期</b>，绑定了 {b.length} 个在用订阅{b.length ? `：${b.slice(0, 6).map((s) => s.name).join('、')}${b.length > 6 ? ' 等' : ''}` : ''}。换卡后请到这些服务里更新付款方式，避免扣费失败导致服务中断。</div>
            <Link className="btn-text" href={`/subscriptions?pay=${p.id}`}>查看订阅</Link>
          </div>
        );
      })}
      <section className="card">
        <div className="card-h">
          <h2>支付方式 <span className="t3" style={{ fontWeight: 400, fontSize: 14 }}>{list.length}</span></h2>
          <Link className="btn btn-primary btn-sm" href={hrefWith('/pay-methods', sp, { new: 1 })} scroll={false}><Icon name="plus" />添加支付方式</Link>
        </div>
        {list.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>支付方式</th><th>类型</th><th>有效期</th><th>绑定订阅</th><th className="r">每月扣款</th><th>操作</th></tr></thead>
              <tbody>
                {P.items.map((p) => {
                  const b = bound(p.id);
                  return (
                    <tr key={p.id}>
                      <td><div className="svc"><span className="pay-ic"><Icon name="card" /></span><div><div>{p.name}</div>{p.note && <div className="sub">{p.note}</div>}</div></div></td>
                      <td><Tag tone="gray">{p.type}</Tag></td>
                      <td>{p.expireMonth ? <><span className="num">{p.expireMonth}</span> {expiring.has(p.id) && <Tag tone="orange">即将到期</Tag>}</> : <span className="t3">长期有效</span>}</td>
                      <td><div className="svc"><span className="stack">{b.slice(0, 5).map((s) => <Logo key={s.id} name={s.name} />)}</span><span className="t2">{b.length} 个</span></div></td>
                      <td className="r num">{formatYuan(b.reduce((a, s) => a + s.monthlyCents, 0), 0)}</td>
                      <td><div className="ops"><Link className="btn-text" href={`/subscriptions?pay=${p.id}`}>查看订阅</Link><Link className="btn-text" href={hrefWith('/pay-methods', sp, { edit: p.id })} scroll={false}>编辑</Link></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">还没有支付方式。新建订阅时也可以直接新建支付方式。</div>}
        <Pager p={P} path="/pay-methods" sp={sp} />
        <PayDialogs rows={list.map((p) => ({ id: p.id, name: p.name, type: p.type, expireMonth: p.expireMonth, note: p.note, bound: bound(p.id).length }))} />
      </section>
    </>
  );
}
