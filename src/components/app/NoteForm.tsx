'use client';

import { useState } from 'react';
import { deleteNote, saveNote } from '@/app/actions';
import { NOTE_COLORS } from '@/lib/constants';
import { Modal } from '../ui/Modal';
import { useApp } from './AppProvider';

export interface NoteInitial {
  id?: number;
  targetType?: 'email' | 'sub';
  targetId?: number;
  title?: string;
  body?: string;
  color?: string;
  pinned?: boolean;
}

export function NoteForm({ initial, onClose }: { initial: NoteInitial; onClose: () => void }) {
  const { data, run } = useApp();
  const firstTarget = data.subOptions[0] ? `sub:${data.subOptions[0].id}` : data.emails[0] ? `email:${data.emails[0].id}` : '';
  const [target, setTarget] = useState(initial.targetType && initial.targetId ? `${initial.targetType}:${initial.targetId}` : firstTarget);
  const [title, setTitle] = useState(initial.title ?? '');
  const [body, setBody] = useState(initial.body ?? '');
  const [color, setColor] = useState(initial.color ?? 'yellow');
  const [pinned, setPinned] = useState(!!initial.pinned);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const [targetType, targetId] = target.split(':');
    const r = await saveNote({ id: initial.id, targetType: targetType as 'email' | 'sub', targetId: Number(targetId), title, body, color, pinned });
    if (!r.ok) return setError(r.error || '保存失败');
    await run(Promise.resolve(r), initial.id ? '卡片已保存' : '卡片已创建');
    onClose();
  }

  if (!firstTarget) {
    return <Modal title="新建卡片" onClose={onClose} width={480}><p style={{ marginTop: 16 }}>请先添加邮箱或订阅，卡片需要关联到其中一个账号。</p></Modal>;
  }

  return (
    <Modal
      title={initial.id ? '编辑卡片' : '新建卡片'}
      onClose={onClose}
      width={560}
      footer={
        <>
          {initial.id && (confirmDel ? (
            <button type="button" className="btn btn-danger-t" style={{ marginRight: 'auto' }} onClick={async () => { if (await run(deleteNote(initial.id!), '已移入回收站')) onClose(); }}>确认删除</button>
          ) : (
            <button type="button" className="btn-text danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDel(true)}>删除</button>
          ))}
          {error && <span className="form-err">{error}</span>}
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" form="note-form">{initial.id ? '保存' : '创建'}</button>
        </>
      }
    >
      <form id="note-form" onSubmit={submit}>
        <div className="fg" style={{ paddingTop: 16 }}>
          <div className="f full">
            <label htmlFor="n-target" className="req">关联账号</label>
            <select className="sel" id="n-target" value={target} onChange={(e) => setTarget(e.target.value)}>
              <optgroup label="邮箱">{data.emails.map((e) => <option key={e.id} value={`email:${e.id}`}>{e.address}</option>)}</optgroup>
              <optgroup label="服务">{data.subOptions.map((s) => <option key={s.id} value={`sub:${s.id}`}>{s.name} {s.plan}（{s.emailAddress}）</option>)}</optgroup>
            </select>
          </div>
          <div className="f full">
            <label htmlFor="n-title" className="req">标题</label>
            <input className="inp" id="n-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：怎么取消订阅" />
          </div>
          <div className="f full">
            <label htmlFor="n-body">内容</label>
            <textarea id="n-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="记录取消路径、发票、共享成员、注意事项等" />
            <span className="hint">请不要在卡片里记录密码。</span>
          </div>
          <div className="f">
            <span className="lab">颜色</span>
            <div className="swatches">
              {NOTE_COLORS.map(([c, t]) => (
                <label key={c} className={`sw-c dot nc-${c}`} title={t}>
                  <input type="radio" name="n-color" value={c} checked={color === c} onChange={() => setColor(c)} aria-label={t} />
                </label>
              ))}
            </div>
          </div>
          <div className="f" style={{ alignContent: 'end' }}>
            <label className="sw"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />置顶显示</label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
