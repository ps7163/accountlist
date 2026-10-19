import { listTrash } from '@/lib/trash';
import { paginate, param, type Search } from '@/lib/paging';
import { Icon, type IconName } from '@/components/icons';
import { Tag } from '@/components/ui/Tag';
import { Pager } from '@/components/ui/Pager';
import { EmptyTrash, TrashActions } from '@/components/app/TrashUI';

const TYPE: Record<string, [string, IconName]> = { sub: ['订阅', 'list'], email: ['邮箱', 'mail'], pay: ['支付方式', 'card'], note: ['备注卡片', 'note'] };
const beijing = (iso: string) => new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }).replace(/\//g, '-');
const daysLeft = (iso: string) => Math.max(0, 30 - Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

export default async function TrashPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const items = listTrash();
  const P = paginate(items, param(sp, 'page'), param(sp, 'size'));
  return (
    <section className="card">
      <div className="card-h">
        <h2>回收站 <span className="t3" style={{ fontWeight: 400, fontSize: 14 }}>{items.length}</span></h2>
        <EmptyTrash count={items.length} />
      </div>
      <div className="batch" style={{ background: 'var(--fill)', color: 'var(--text-2)' }}>删除的订阅、邮箱、支付方式和卡片会在这里保留 30 天，之后自动彻底删除。恢复订阅时，它的付费记录和备注卡片会一起恢复。</div>
      {items.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>类型</th><th>名称</th><th>删除时间</th><th>剩余天数</th><th>操作</th></tr></thead>
            <tbody>
              {P.items.map((x) => (
                <tr key={`${x.type}-${x.id}`}>
                  <td><span className="svc"><span className="pay-ic"><Icon name={TYPE[x.type][1]} /></span>{TYPE[x.type][0]}</span></td>
                  <td><div>{x.title}</div>{x.sub && <div className="sub">{x.sub}</div>}</td>
                  <td className="num t2">{beijing(x.deletedAt)}</td>
                  <td>{daysLeft(x.deletedAt) <= 3 ? <Tag tone="orange">{daysLeft(x.deletedAt)} 天</Tag> : <span className="t2">{daysLeft(x.deletedAt)} 天</span>}</td>
                  <td><TrashActions type={x.type} id={x.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">回收站是空的</div>}
      <Pager p={P} path="/trash" sp={sp} />
    </section>
  );
}
