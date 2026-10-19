'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { deleteEmail, saveEmail, type EmailInput } from '@/app/actions';
import { maskPhone } from '@/lib/constants';
import { Icon } from '../icons';
import { Modal } from '../ui/Modal';
import { useApp } from './AppProvider';

export interface EmailRow { id: number; address: string; phone: string; recovery: string; note: string }

export function PhoneReveal({ phone }: { phone: string }) {
  const [show, setShow] = useState(false);
  if (!phone) return <span className="t3">—</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <span className="num">{show ? phone : maskPhone(phone)}</span>
      <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setShow(!show)} aria-label={show ? '隐藏手机号' : '显示完整手机号'}><Icon name="eye" /></button>
    </span>
  );
}

function EmailForm({ initial, onClose }: { initial?: EmailRow; onClose: () => void }) {
  const { run } = useApp();
  const [v, setV] = useState<EmailInput>(initial ?? { address: '', phone: '', recovery: '', note: '' });
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: keyof EmailInput, val: string) => setV({ ...v, [k]: val });
  return (
    <Modal title={initial ? '编辑邮箱' : '添加邮箱'} onClose={onClose} width={520}
      footer={<>
        {initial && (confirmDel
          ? <button className="btn btn-danger-t" style={{ marginRight: 'auto' }} onClick={async () => { if (await run(deleteEmail(initial.id), '邮箱已删除')) onClose(); }}>确认删除</button>
          : <button className="btn-text danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDel(true)}>删除</button>)}
        {error && <span className="form-err">{error}</span>}
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn-primary" form="email-form">{initial ? '保存' : '添加'}</button>
      </>}>
      <form id="email-form" onSubmit={async (e) => {
        e.preventDefault();
        const r = await saveEmail({ ...v, id: initial?.id });
        if (!r.ok) return setError(r.error || '保存失败');
        await run(Promise.resolve(r), initial ? '已保存' : `已添加 ${v.address}`);
        onClose();
      }}>
        <div className="fg" style={{ paddingTop: 16 }}>
          <div className="f full"><label htmlFor="m-addr" className="req">邮箱地址</label><input className="inp" id="m-addr" type="email" required value={v.address} onChange={(e) => set('address', e.target.value)} placeholder="name@gmail.com" /></div>
          <div className="f"><label htmlFor="m-phone">绑定手机</label><input className="inp" id="m-phone" value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+86 138 0000 0000" /></div>
          <div className="f"><label htmlFor="m-rec">辅助邮箱</label><input className="inp" id="m-rec" type="email" value={v.recovery} onChange={(e) => set('recovery', e.target.value)} placeholder="用于找回账号" /></div>
          <div className="f full"><label htmlFor="m-note">备注</label><input className="inp" id="m-note" value={v.note} onChange={(e) => set('note', e.target.value)} placeholder="如：主力号 / 注册小号" /></div>
          <div className="f full hint">系统不保存邮箱密码。手机号默认打码显示。</div>
        </div>
      </form>
    </Modal>
  );
}

/** 根据 ?new=1 / ?edit=ID 打开邮箱表单 */
export function EmailDialogs({ rows }: { rows: EmailRow[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const editId = Number(sp.get('edit'));
  const open = sp.get('new') === '1' || !!editId;
  if (!open) return null;
  const close = () => {
    const q = new URLSearchParams(sp.toString());
    q.delete('new');
    q.delete('edit');
    router.replace(q.toString() ? `${path}?${q}` : path, { scroll: false });
  };
  return <EmailForm key={editId || 'new'} initial={rows.find((r) => r.id === editId)} onClose={close} />;
}

export function AddNoteButton({ type, id }: { type: 'email' | 'sub'; id: number }) {
  const { openNote } = useApp();
  return <button className="btn-text" onClick={() => openNote({ targetType: type, targetId: id })}>加卡片</button>;
}
