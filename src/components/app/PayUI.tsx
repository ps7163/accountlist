'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { deletePayMethod, savePayMethod, type PayInput } from '@/app/actions';
import { PAY_TYPES } from '@/lib/constants';
import { Modal } from '../ui/Modal';
import { useApp } from './AppProvider';

export interface PayRow { id: number; name: string; type: string; expireMonth: string | null; note: string; bound: number }

function PayForm({ initial, onClose }: { initial?: PayRow; onClose: () => void }) {
  const { run } = useApp();
  const [v, setV] = useState<PayInput>({ name: initial?.name ?? '', type: initial?.type ?? '信用卡', expireMonth: initial?.expireMonth ?? '', note: initial?.note ?? '' });
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: keyof PayInput, val: string) => setV({ ...v, [k]: val });
  return (
    <Modal title={initial ? '编辑支付方式' : '添加支付方式'} onClose={onClose} width={520}
      footer={<>
        {initial && (confirmDel
          ? <button className="btn btn-danger-t" style={{ marginRight: 'auto' }} onClick={async () => { if (await run(deletePayMethod(initial.id), '已移入回收站')) onClose(); }}>确认删除{initial.bound ? `（${initial.bound} 个订阅将变为未指定）` : ''}</button>
          : <button className="btn-text danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDel(true)}>删除</button>)}
        {error && <span className="form-err">{error}</span>}
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn-primary" form="pay-form">{initial ? '保存' : '添加'}</button>
      </>}>
      <form id="pay-form" onSubmit={async (e) => {
        e.preventDefault();
        const r = await savePayMethod({ ...v, id: initial?.id });
        if (!r.ok) return setError(r.error || '保存失败');
        await run(Promise.resolve(r), '已保存');
        onClose();
      }}>
        <div className="fg" style={{ paddingTop: 16 }}>
          <div className="f full"><label htmlFor="p-name" className="req">名称</label><input className="inp" id="p-name" required value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="如：招行信用卡 尾号 1234、alex.us@icloud.com" /></div>
          <div className="f"><label htmlFor="p-type">类型</label><select className="sel" id="p-type" value={v.type} onChange={(e) => set('type', e.target.value)}>{PAY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="f"><label htmlFor="p-exp">有效期</label><input className="inp" id="p-exp" type="month" value={v.expireMonth} onChange={(e) => set('expireMonth', e.target.value)} /><span className="hint">信用卡填卡面有效期；留空表示长期有效</span></div>
          <div className="f full"><label htmlFor="p-note">备注</label><input className="inp" id="p-note" value={v.note} onChange={(e) => set('note', e.target.value)} placeholder="如：账单日每月 5 号" /></div>
          <div className="f full hint">只记录卡的名称和尾号，不要填写完整卡号或密码。</div>
        </div>
      </form>
    </Modal>
  );
}

export function PayDialogs({ rows }: { rows: PayRow[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const editId = Number(sp.get('edit'));
  if (sp.get('new') !== '1' && !editId) return null;
  const close = () => {
    const q = new URLSearchParams(sp.toString());
    q.delete('new');
    q.delete('edit');
    router.replace(q.toString() ? `${path}?${q}` : path, { scroll: false });
  };
  return <PayForm key={editId || 'new'} initial={rows.find((r) => r.id === editId)} onClose={close} />;
}
