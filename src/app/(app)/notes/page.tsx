import Link from 'next/link';
import { listEmails, listNotes, listSubs } from '@/lib/queries';
import { NOTE_COLORS } from '@/lib/constants';
import { hrefWith, paginate, param, type Search } from '@/lib/paging';
import { Pager } from '@/components/ui/Pager';
import { FilterSelect, SearchBox } from '@/components/app/Filters';
import { NewNoteButton, NotesGrid, type NoteRow } from '@/components/app/NotesUI';

export default async function NotesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = param(sp, 'q').toLowerCase();
  const type = param(sp, 'type');
  const color = param(sp, 'color');
  const emails = new Map(listEmails().map((e) => [e.id, e]));
  const subs = new Map(listSubs().map((s) => [s.id, s]));
  const rows: NoteRow[] = listNotes()
    .map((n) => {
      const e = n.targetType === 'email' ? emails.get(n.targetId) : undefined;
      const s = n.targetType === 'sub' ? subs.get(n.targetId) : undefined;
      const target = e ? { name: e.address, logo: e.provider } : s ? { name: `${s.name} ${s.plan}`.trim(), logo: s.name } : { name: '已删除的账号', logo: '?' };
      return { id: n.id, targetType: n.targetType, targetId: n.targetId, title: n.title, body: n.body, color: n.color, pinned: n.pinned, updatedAt: n.updatedAt, target };
    })
    .filter((n) => (!type || n.targetType === type) && (!color || n.color === color) && (!q || [n.title, n.body, n.target.name].join(' ').toLowerCase().includes(q)));
  const P = paginate(rows, param(sp, 'page'), param(sp, 'size'), 12);
  return (
    <section className="card">
      <div className="toolbar">
        <SearchBox placeholder="搜索标题、内容、账号" />
        <FilterSelect name="type" label="全部账号" options={[['email', '邮箱'], ['sub', '服务']]} />
        <div className="swatches" role="group" aria-label="按颜色筛选">
          <Link className={`sw-c ${color ? '' : 'on'}`} href={hrefWith('/notes', sp, { color: null, page: null })} scroll={false}>全部</Link>
          {NOTE_COLORS.map(([c, t]) => (
            <Link key={c} className={`sw-c dot nc-${c} ${color === c ? 'on' : ''}`} href={hrefWith('/notes', sp, { color: c, page: null })} title={t} aria-label={t} scroll={false} />
          ))}
        </div>
        <span className="sp" />
        <NewNoteButton />
      </div>
      {rows.length ? <NotesGrid rows={P.items} /> : <div className="empty">{q || type || color ? '没有符合条件的卡片' : '还没有卡片。可以给邮箱或服务记下取消方法、发票、共享成员等信息。'}</div>}
      <Pager p={P} path="/notes" sp={sp} left={`共 ${rows.length} 张卡片`} />
    </section>
  );
}
