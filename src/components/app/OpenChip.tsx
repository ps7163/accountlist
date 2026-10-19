'use client';

import { useApp } from './AppProvider';

export function OpenChip({ id, className, title, children }: { id: number; className?: string; title?: string; children: React.ReactNode }) {
  const { openDetail } = useApp();
  return <button type="button" className={className} title={title} onClick={() => openDetail(id)}>{children}</button>;
}
