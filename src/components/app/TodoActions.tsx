'use client';

import { clearSnoozes, convertTrial, markRenewed, snoozeSubscription } from '@/app/actions';
import { useApp } from './AppProvider';

export function TodoActions({ id, trial }: { id: number; trial: boolean }) {
  const { run, openCancel } = useApp();
  return (
    <div className="todo-a">
      {trial ? (
        <>
          <button className="btn btn-sm" onClick={() => openCancel(id)}>不要了</button>
          <button className="btn btn-sm btn-primary" onClick={() => run(convertTrial(id), '已转为正式订阅')}>保留</button>
        </>
      ) : (
        <>
          <button className="btn btn-sm" onClick={() => openCancel(id)}>不续了</button>
          <button className="btn btn-sm btn-primary" onClick={() => run(markRenewed(id), (r) => `已记录续费，下次扣费 ${r.nextDate}`)}>已续费</button>
        </>
      )}
      <select className="sel snooze" aria-label="稍后提醒" value="" onChange={(e) => e.target.value && run(snoozeSubscription(id, Number(e.target.value)), (r) => `将在 ${r.until} 再次提醒`)}>
        <option value="">稍后提醒</option>
        <option value="1">明天再提醒</option>
        <option value="3">3 天后提醒</option>
        <option value="7">7 天后提醒</option>
      </select>
    </div>
  );
}

export function ClearSnoozes() {
  const { run } = useApp();
  return <button className="btn-text" onClick={() => run(clearSnoozes(), '已恢复全部提醒')}>全部恢复</button>;
}
