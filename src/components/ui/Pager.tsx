import Link from 'next/link';
import { hrefWith, type Search } from '@/lib/paging';
import { Icon } from '../icons';
import { PageSize } from './PageSize';

interface P {
  page: number;
  pages: number;
  total: number;
  size: number;
}

/** 页码导航：1 … 4 5 6 … 12 */
export function PagerNav({ p, path, sp, pageKey = 'page' }: { p: P; path: string; sp: Search; pageKey?: string }) {
  if (p.pages <= 1) return null;
  const nums: (number | '…')[] = [];
  for (let i = 1; i <= p.pages; i++) {
    if (i === 1 || i === p.pages || Math.abs(i - p.page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  const link = (n: number) => hrefWith(path, sp, { [pageKey]: n === 1 ? null : n });
  return (
    <nav className="pager" aria-label="分页">
      {p.page > 1 ? <Link href={link(p.page - 1)} aria-label="上一页" scroll={false}><Icon name="left" /></Link> : <span className="pg-dis"><Icon name="left" /></span>}
      {nums.map((n, i) =>
        n === '…' ? <span key={`e${i}`} className="ellip">…</span> : (
          <Link key={n} href={link(n)} aria-current={n === p.page ? 'page' : undefined} scroll={false}>{n}</Link>
        ),
      )}
      {p.page < p.pages ? <Link href={link(p.page + 1)} aria-label="下一页" scroll={false}><Icon name="right" /></Link> : <span className="pg-dis"><Icon name="right" /></span>}
    </nav>
  );
}

export function Pager({ p, path, sp, left, pageKey = 'page', sizeKey = 'size' }: { p: P; path: string; sp: Search; left?: React.ReactNode; pageKey?: string; sizeKey?: string }) {
  return (
    <div className="tbl-foot">
      <span>{left ?? `共 ${p.total} 条`}</span>
      <div className="pager-wrap">
        <PagerNav p={p} path={path} sp={sp} pageKey={pageKey} />
        <PageSize size={p.size} sizeKey={sizeKey} pageKey={pageKey} />
      </div>
    </div>
  );
}
