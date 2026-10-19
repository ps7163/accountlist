'use client';

import { useEffect, useState } from 'react';
import { cancelSubscription, getSubDetail } from '@/app/actions';
import { CYCLE_UNIT, formatYuan } from '@/lib/billing';
import { GUIDES } from '@/lib/constants';
import { Icon } from '../icons';
import { Modal } from '../ui/Modal';
import { useApp } from './AppProvider';

type Detail = NonNullable<Awaited<ReturnType<typeof getSubDetail>>>;

/** 取消订阅 / 试用决策：给出按渠道生成的取消步骤，确认后标记为已取消 */
export function CancelFlow({ id, onClose }: { id: number; onClose: () => void }) {
  const { run } = useApp();
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => {
    getSubDetail(id).then((r) => (r ? setD(r) : onClose()));
  }, [id, onClose]);
  if (!d) return <Modal title="取消订阅" onClose={onClose} width={520}><div className="empty">加载中…</div></Modal>;
  const s = d.sub;
  return (
    <Modal
      title={`${s.trialEnd ? '不再继续试用' : '取消订阅'} · ${s.name} ${s.plan}`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose}>稍后再说</button>
          <button className="btn btn-primary" onClick={async () => { if (await run(cancelSubscription(s.id), `${s.name} 已标记为取消`)) onClose(); }}>我已取消</button>
        </>
      }
    >
      <div style={{ paddingTop: 16, display: 'grid', gap: 16 }}>
        <div className="trial-box" style={{ background: 'var(--orange-soft)', color: 'var(--orange-text)' }}>
          {s.trialEnd ? (
            <>请在 <b>{s.trialEnd}</b> 之前取消，否则会开始按 {formatYuan(s.priceCents)}/{CYCLE_UNIT[s.cycle]} 扣费。</>
          ) : (
            <>下次扣费日 <b>{s.nextDate}</b>，在这之前取消就不会再扣 {formatYuan(s.priceCents)}。</>
          )}
        </div>
        <div>
          <div className="sec-t">按「{s.channel || '其他'}」取消的步骤</div>
          <ol className="guide">{(GUIDES[s.channel] || GUIDES['其他']).map((x) => <li key={x}>{x}</li>)}</ol>
        </div>
        {s.manageUrl && (
          <a className="btn" href={s.manageUrl} target="_blank" rel="noopener noreferrer" style={{ justifySelf: 'start' }}><Icon name="ext" />打开管理页面</a>
        )}
        {d.notes.length > 0 && <div className="hint">这个服务有 {d.notes.length} 张备注卡片，可以在详情里查看。</div>}
        <div className="hint">点「我已取消」后，到期前仍显示为已取消，不会再提醒。</div>
      </div>
    </Modal>
  );
}
