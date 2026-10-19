'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logoutAction } from '@/app/auth-actions';
import { savePrefs } from '@/app/actions';
import { SKINS, skinImage } from '@/lib/skins';
import { Icon, Logo, type IconName } from '../icons';
import { Tag } from '../ui/Tag';
import { useApp } from './AppProvider';

export interface BellItem {
  id: number;
  name: string;
  plan: string;
  date: string;
  price: string;
  label: string;
  tone: string;
}

const NAV: { href: string; label: string; icon: IconName; group?: string }[] = [
  { href: '/', label: '工作台', icon: 'home' },
  { href: '/subscriptions', label: '订阅管理', icon: 'list', group: '管理' },
  { href: '/emails', label: '邮箱账号', icon: 'mail' },
  { href: '/pay-methods', label: '支付方式', icon: 'card' },
  { href: '/notes', label: '备注卡片', icon: 'note' },
  { href: '/security', label: '账号安全', icon: 'shield' },
  { href: '/calendar', label: '扣费日历', icon: 'cal', group: '账单' },
  { href: '/bills', label: '付费记录', icon: 'bill' },
  { href: '/settings', label: '系统设置', icon: 'gear', group: '系统' },
];

const Mark = () => (
  <span className="logo-mark">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M5 7h14M5 12h14M5 17h8" /></svg>
  </span>
);

export function Shell({ children, skin, displayName, bell, riskCount }: { children: React.ReactNode; skin: string; displayName: string; bell: BellItem[]; riskCount: number }) {
  const path = usePathname();
  const { openNew, openDetail, run } = useApp();
  const [menu, setMenu] = useState(false);
  const [pop, setPop] = useState<'bell' | 'skin' | null>(null);
  const [curSkin, setSkin] = useState(skin);
  useEffect(() => setMenu(false), [path]);
  useEffect(() => setSkin(skin), [skin]);

  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const title = NAV.find((n) => active(n.href))?.label ?? '账号簿';

  return (
    <div className="app">
      <div className="skin" aria-hidden="true" style={{ backgroundImage: skinImage(curSkin) }} />
      <aside className={`side ${menu ? 'open' : ''}`}>
        <div className="logo-row"><Mark />账号簿</div>
        <nav className="menu">
          {NAV.map((n) => (
            <div key={n.href} style={{ display: 'contents' }}>
              {n.group && <div className="menu-label">{n.group}</div>}
              <Link className="m-item" href={n.href} aria-current={active(n.href) ? 'page' : undefined}>
                <Icon name={n.icon} />
                <span>{n.label}</span>
                {n.href === '/subscriptions' && bell.length > 0 && <span className="m-badge">{bell.length}</span>}
                {n.href === '/security' && riskCount > 0 && <span className="m-badge" style={{ background: 'var(--orange)' }}>{riskCount}</span>}
              </Link>
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <span className="avatar">{displayName.slice(0, 1)}</span>
          <div style={{ minWidth: 0, flex: 1 }}><div className="ell">{displayName}</div></div>
          <form action={logoutAction}><button className="btn-text" style={{ fontSize: 13 }}>退出</button></form>
        </div>
      </aside>
      {menu && <div className="mask side-mask" onClick={() => setMenu(false)} />}
      <div className="mainc">
        <header className="header">
          <button className="icon-btn burger" onClick={() => setMenu(!menu)} aria-label="打开菜单">
            <svg className="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="crumb"><b>{title}</b></div>
          <div className="h-r">
            <button className="icon-btn" onClick={() => setPop(pop === 'skin' ? null : 'skin')} aria-label="更换皮肤" title="更换皮肤"><Icon name="skin" /></button>
            <button className="icon-btn" onClick={() => setPop(pop === 'bell' ? null : 'bell')} aria-label="到期提醒">
              <Icon name="bell" />
              {bell.length > 0 && <span className="dot">{bell.length}</span>}
            </button>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => openNew()}><Icon name="plus" /><span>新建订阅</span></button>
          </div>
        </header>
        <main className="content"><div className="wrap">{children}</div></main>
      </div>

      {pop && <div className="mask" style={{ background: 'transparent' }} onClick={() => setPop(null)} />}
      {pop === 'bell' && (
        <div className="pop" role="dialog" aria-label="到期提醒">
          <div className="pop-h"><span>到期提醒</span><Link href="/" className="t3" style={{ fontWeight: 400, fontSize: 12 }} onClick={() => setPop(null)}>去工作台处理</Link></div>
          <div className="pop-b">
            {bell.length ? bell.map((b) => (
              <div key={b.id} className="li" onClick={() => { setPop(null); openDetail(b.id); }}>
                <Logo name={b.name} />
                <div className="grow"><div className="nm">{b.name} {b.plan}</div><div className="t3" style={{ fontSize: 12 }}>{b.date} · {b.price}</div></div>
                <Tag tone={b.tone}>{b.label}</Tag>
              </div>
            )) : <div className="empty">暂无提醒</div>}
          </div>
        </div>
      )}
      {pop === 'skin' && (
        <div className="pop" role="dialog" aria-label="更换皮肤">
          <div className="pop-h"><span>更换皮肤</span></div>
          <div className="skins">
            {Object.entries(SKINS).map(([k, v]) => (
              <button key={k} className="sk" aria-pressed={curSkin === k} onClick={() => { setSkin(k); run(savePrefs({ skin: k })); }}>
                <i style={v.svg ? { backgroundImage: skinImage(k) } : { background: 'var(--fill)' }} />
                <span>{v.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
