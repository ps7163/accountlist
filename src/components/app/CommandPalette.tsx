'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Logo, type IconName } from '../icons';
import { useApp } from './AppProvider';

export interface SearchIndex {
  subs: { id: number; name: string; plan: string; email: string; category: string; price: string }[];
  emails: { id: number; address: string; provider: string; note: string }[];
  pays: { id: number; name: string; type: string }[];
  notes: { id: number; title: string; body: string }[];
  pages: { href: string; label: string; icon: IconName }[];
}

interface Item {
  key: string;
  group: string;
  title: string;
  sub?: string;
  icon?: IconName;
  logo?: string;
  run: () => void;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** ⌘K / Ctrl+K 全局搜索：订阅、邮箱、支付方式、卡片、页面和常用操作 */
export function CommandPalette({ index, open, onClose }: { index: SearchIndex; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { openDetail, openNew, openNote } = useApp();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const k = norm(q);
    const hit = (...xs: string[]) => !k || xs.some((x) => norm(x).includes(k));
    const go = (href: string) => () => router.push(href);
    const out: Item[] = [];
    const actions: Item[] = [
      { key: 'a-new', group: '操作', title: '新建订阅', icon: 'plus', run: () => openNew() },
      { key: 'a-email', group: '操作', title: '添加邮箱', icon: 'mail', run: go('/emails?new=1') },
      { key: 'a-note', group: '操作', title: '新建备注卡片', icon: 'note', run: () => openNote() },
      { key: 'a-import', group: '操作', title: '导入数据', sub: 'Excel / CSV', icon: 'up', run: go('/settings#data') },
      { key: 'a-backup', group: '操作', title: '下载 JSON 备份', icon: 'down', run: () => { window.location.href = '/api/export?format=json'; } },
    ];
    out.push(...index.subs.filter((s) => hit(s.name, s.plan, s.email, s.category)).slice(0, 8).map((s) => ({ key: `s${s.id}`, group: '订阅', title: `${s.name} ${s.plan}`.trim(), sub: `${s.email} · ${s.price}`, logo: s.name, run: () => openDetail(s.id) })));
    out.push(...index.emails.filter((e) => hit(e.address, e.note)).slice(0, 5).map((e) => ({ key: `e${e.id}`, group: '邮箱', title: e.address, sub: e.note || e.provider, logo: e.provider, run: go(`/subscriptions?email=${e.id}`) })));
    out.push(...index.pays.filter((p) => hit(p.name, p.type)).slice(0, 4).map((p) => ({ key: `p${p.id}`, group: '支付方式', title: p.name, sub: p.type, icon: 'card' as IconName, run: go(`/subscriptions?pay=${p.id}`) })));
    out.push(...index.notes.filter((n) => hit(n.title, n.body)).slice(0, 4).map((n) => ({ key: `n${n.id}`, group: '备注卡片', title: n.title, sub: n.body.slice(0, 40), icon: 'note' as IconName, run: go(`/notes?q=${encodeURIComponent(n.title)}`) })));
    out.push(...actions.filter((a) => hit(a.title, a.sub ?? '')));
    out.push(...index.pages.filter((p) => hit(p.label)).map((p) => ({ key: `g${p.href}`, group: '页面', title: p.label, icon: p.icon, run: go(p.href) })));
    return out;
  }, [q, index, router, openDetail, openNew, openNote]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;
  const choose = (it?: Item) => {
    if (!it) return;
    onClose();
    it.run();
  };
  let lastGroup = '';

  return (
    <>
      <div className="mask" onClick={onClose} />
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="全局搜索">
        <div className="cmdk-in">
          <Icon name="search" size={18} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索订阅、邮箱、支付方式、卡片，或输入操作…" aria-label="搜索"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); choose(items[sel]); }
              else if (e.key === 'Escape') onClose();
            }} />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef} role="listbox">
          {items.length ? items.map((it, i) => {
            const head = it.group !== lastGroup ? <div className="cmdk-g" key={`h-${it.group}`}>{it.group}</div> : null;
            lastGroup = it.group;
            return (
              <div key={it.key} style={{ display: 'contents' }}>
                {head}
                <button type="button" data-i={i} role="option" aria-selected={i === sel} className="cmdk-i" onMouseMove={() => setSel(i)} onClick={() => choose(it)}>
                  {it.logo ? <Logo name={it.logo} /> : <span className="pay-ic"><Icon name={it.icon ?? 'right'} /></span>}
                  <span className="grow"><span className="ell">{it.title}</span>{it.sub && <span className="t3 ell" style={{ fontSize: 12 }}>{it.sub}</span>}</span>
                  {i === sel && <kbd>↵</kbd>}
                </button>
              </div>
            );
          }) : <div className="empty">没有找到「{q}」</div>}
        </div>
        <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>↵</kbd> 打开</span><span><kbd>⌘</kbd><kbd>K</kbd> 随时唤起</span></div>
      </div>
    </>
  );
}
