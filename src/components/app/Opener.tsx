'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useApp } from './AppProvider';

/** 点击打开订阅详情抽屉 */
export function Opener({ id, className, children, as = 'div' }: { id: number; className?: string; children: React.ReactNode; as?: 'div' | 'tr' | 'a' }) {
  const { openDetail } = useApp();
  const props = {
    className,
    role: 'button',
    tabIndex: 0,
    onClick: (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('a[href],button,select,input,label')) return;
      openDetail(id);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        openDetail(id);
      }
    },
  };
  if (as === 'tr') return <tr {...props}>{children}</tr>;
  return <div {...props}>{children}</div>;
}

export function OpenLink({ id, children }: { id: number; children: React.ReactNode }) {
  const { openDetail } = useApp();
  return <button type="button" className="lnk link-btn" onClick={() => openDetail(id)}>{children}</button>;
}

export function NewSubButton({ children, className = 'btn btn-primary btn-sm' }: { children: React.ReactNode; className?: string }) {
  const { openNew } = useApp();
  return <button type="button" className={className} onClick={() => openNew()}>{children}</button>;
}

/** 带 ?new=1 打开页面时自动弹出新建订阅（用于主屏幕快捷方式） */
export function AutoOpenNew() {
  const { openNew } = useApp();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  useEffect(() => {
    if (sp.get('new') !== '1') return;
    openNew();
    const q = new URLSearchParams(sp.toString());
    q.delete('new');
    router.replace(q.toString() ? `${path}?${q}` : path, { scroll: false });
  }, [sp, openNew, router, path]);
  return null;
}
