import Link from 'next/link';
import { formatYuan } from '@/lib/billing';
import { listEmails, listNotes, listSubs } from '@/lib/queries';
import { hrefWith, paginate, param, type Search } from '@/lib/paging';
import { Icon, Logo } from '@/components/icons';
import { Tag } from '@/components/ui/Tag';
import { Pager } from '@/components/ui/Pager';
import { AddNoteButton, EmailDialogs, PhoneReveal } from '@/components/app/EmailUI';

export default async function EmailsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const emails = listEmails();
  const subs = listSubs();
  const notes = listNotes();
  const P = paginate(emails, param(sp, 'page'), param(sp, 'size'));
  return (
    <section className="card">
      <div className="card-h">
        <h2>邮箱账号 <span className="t3" style={{ fontWeight: 400, fontSize: 14 }}>{emails.length}</span></h2>
        <Link className="btn btn-primary btn-sm" href={hrefWith('/emails', sp, { new: 1 })} scroll={false}><Icon name="plus" />添加邮箱</Link>
      </div>
      {emails.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>邮箱</th><th>类型</th><th>绑定手机</th><th>辅助邮箱</th><th className="r">服务数</th><th className="r">每月支出</th><th>备注</th><th>卡片</th><th>操作</th></tr></thead>
            <tbody>
              {P.items.map((e) => {
                const mine = subs.filter((s) => s.emailId === e.id);
                const alerts = mine.filter((s) => s.state.alert).length;
                const n = notes.filter((x) => x.targetType === 'email' && x.targetId === e.id).length;
                return (
                  <tr key={e.id}>
                    <td><div className="svc"><Logo name={e.provider} />{e.address}</div></td>
                    <td><Tag tone="blue">{e.provider}</Tag></td>
                    <td><PhoneReveal phone={e.phone} /></td>
                    <td className="t2">{e.recovery || <Tag tone="red">未设置</Tag>}</td>
                    <td className="r num">{alerts > 0 && <><Tag tone="orange">{alerts} 项待处理</Tag> </>}{mine.length}</td>
                    <td className="r num">{formatYuan(mine.reduce((a, s) => a + s.monthlyCents, 0), 0)}</td>
                    <td className="t2">{e.note || '—'}</td>
                    <td>{n ? <Link className="btn-text" href={`/notes?q=${encodeURIComponent(e.address)}`}><Icon name="note" />{n} 张</Link> : <span className="t3">—</span>}</td>
                    <td><div className="ops">
                      <Link className="btn-text" href={`/subscriptions?email=${e.id}`}>查看服务</Link>
                      <AddNoteButton type="email" id={e.id} />
                      <Link className="btn-text" href={hrefWith('/emails', sp, { edit: e.id })} scroll={false}>编辑</Link>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">还没有邮箱。先添加一个邮箱，再给它添加注册过的服务。</div>}
      <Pager p={P} path="/emails" sp={sp} />
      <EmailDialogs rows={emails.map(({ id, address, phone, recovery, note }) => ({ id, address, phone, recovery, note }))} />
    </section>
  );
}
