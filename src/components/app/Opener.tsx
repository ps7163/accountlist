'use client';

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
