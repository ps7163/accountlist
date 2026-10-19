'use client';

import { useState } from 'react';
import { emptyTrash, purgeItem, restoreItem, type TrashType } from '@/app/actions';
import { useApp } from './AppProvider';

export function TrashActions({ type, id }: { type: TrashType; id: number }) {
  const { run } = useApp();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="ops">
      <button className="btn-text" onClick={() => run(restoreItem(type, id), '已恢复')}>恢复</button>
      {confirm
        ? <button className="btn-text danger" onClick={() => run(purgeItem(type, id), '已彻底删除')}>确认彻底删除</button>
        : <button className="btn-text danger" onClick={() => setConfirm(true)}>彻底删除</button>}
    </div>
  );
}

export function EmptyTrash({ count }: { count: number }) {
  const { run } = useApp();
  const [confirm, setConfirm] = useState(false);
  if (!count) return null;
  return confirm
    ? <button className="btn btn-sm btn-danger-t" onClick={() => run(emptyTrash(), (r) => `已彻底删除 ${r.count} 项`).then(() => setConfirm(false))}>确认清空 {count} 项</button>
    : <button className="btn btn-sm" onClick={() => setConfirm(true)}>清空回收站</button>;
}
