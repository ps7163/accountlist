import { desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { paginate, param, type Search } from '@/lib/paging';
import { Pager } from '@/components/ui/Pager';
import { FilterSelect, SearchBox } from '@/components/app/Filters';
import { Tag } from '@/components/ui/Tag';

const tone = (a: string) => (/删除|失败|清空/.test(a) ? 'red' : /新建|添加|恢复|导入/.test(a) ? 'green' : /登录|密码|两步|退出/.test(a) ? 'purple' : 'blue');
const beijing = (utc: string) => new Date(utc.replace(' ', 'T') + 'Z').toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }).replace(/\//g, '-');
const KINDS: [string, string][] = [['订阅', '订阅'], ['邮箱', '邮箱'], ['支付方式', '支付方式'], ['卡片', '卡片'], ['登录', '登录与安全'], ['删除', '删除'], ['导', '导入导出']];

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = param(sp, 'q').toLowerCase();
  const kind = param(sp, 'kind');
  const rows = db.select().from(schema.activity).orderBy(desc(schema.activity.id)).limit(5000).all()
    .filter((r) => (!kind || r.action.includes(kind) || (kind === '登录' && /密码|两步|退出/.test(r.action))) && (!q || [r.action, r.target, r.detail].join(' ').toLowerCase().includes(q)));
  const P = paginate(rows, param(sp, 'page'), param(sp, 'size'), 20);
  return (
    <section className="card">
      <div className="toolbar">
        <SearchBox placeholder="搜索操作、对象、详情" />
        <FilterSelect name="kind" label="全部操作" options={KINDS} />
        <span className="sp" />
        <span className="t3" style={{ fontSize: 12 }}>保留最近一年的记录</span>
      </div>
      {rows.length ? (
        <div className="tbl-wrap">
          <table className="tbl compact">
            <thead><tr><th>时间</th><th>操作</th><th>对象</th><th>详情</th></tr></thead>
            <tbody>
              {P.items.map((r) => (
                <tr key={r.id}>
                  <td className="num t2">{beijing(r.at)}</td>
                  <td><Tag tone={tone(r.action)}>{r.action}</Tag></td>
                  <td>{r.target || '—'}</td>
                  <td className="t2">{r.detail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">还没有操作记录</div>}
      <Pager p={P} path="/activity" sp={sp} />
    </section>
  );
}
