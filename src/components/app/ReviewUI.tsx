'use client';

import { finishReview, keepSubscription, setUsage } from '@/app/actions';
import { USAGES } from '@/lib/constants';
import { useApp } from './AppProvider';

export function UsageSelect({ id, value }: { id: number; value: string }) {
  const { run } = useApp();
  return (
    <select className="sel" style={{ height: 28 }} aria-label="使用频率" value={value} onChange={(e) => run(setUsage(id, e.target.value), '已标记')}>
      {Object.entries(USAGES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
    </select>
  );
}

export function WasteActions({ id }: { id: number }) {
  const { run, openCancel } = useApp();
  return (
    <div className="ops">
      <button className="btn-text" onClick={() => openCancel(id)}>去取消</button>
      <button className="btn-text" onClick={() => run(keepSubscription(id), '已保留，90 天内不再提示')}>保留</button>
    </div>
  );
}

export function FinishReview() {
  const { run } = useApp();
  return <button className="btn btn-primary" onClick={() => run(finishReview(), '已完成本次体检，90 天后再提醒你')}>完成本次体检</button>;
}
