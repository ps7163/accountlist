'use client';

import { useRef, useState } from 'react';
import type { ImportResult } from '@/lib/io';
import { Icon } from '../icons';
import { Modal } from '../ui/Modal';
import { Tag } from '../ui/Tag';
import { useApp } from './AppProvider';

async function post(url: string, file: File, extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set('file', file);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  const res = await fetch(url, { method: 'POST', body: fd });
  const json = await res.json().catch(() => ({ error: '服务器返回了无法识别的内容' }));
  return { ok: res.ok, json };
}

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { toast, refresh } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const step = res?.imported !== undefined ? 3 : res ? 2 : 1;

  async function preview(f: File) {
    setFile(f);
    setRes(null);
    setError('');
    setBusy(true);
    const r = await post('/api/import', f);
    setBusy(false);
    if (!r.ok) return setError(r.json.error || '无法读取文件');
    setRes(r.json);
  }
  async function commit() {
    if (!file) return;
    setBusy(true);
    const r = await post('/api/import', file, { commit: '1' });
    setBusy(false);
    if (!r.ok) return setError(r.json.error || '导入失败');
    setRes(r.json);
    toast(`已导入 ${r.json.imported} 个订阅`);
    refresh();
  }
  const bad = res?.rows.filter((r) => r.error || r.skip) ?? [];

  return (
    <Modal
      title="导入数据"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>{step === 3 ? '完成' : '取消'}</button>
          {step === 2 && <button className="btn btn-primary" disabled={busy || !res?.ok} onClick={commit}>{busy ? '导入中…' : `导入 ${res?.ok ?? 0} 行`}</button>}
        </>
      }
    >
      <div className="steps">
        {['上传文件', '预览校验', '完成导入'].map((t, i) => (
          <span key={t} style={{ display: 'contents' }}>
            {i > 0 && <div className="stp-line" />}
            <div className={`stp ${step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}`}><span className="k">{i + 1}</span><span>{t}</span></div>
          </span>
        ))}
      </div>
      {step < 3 && (
        <div className="upload" role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) preview(f); }}>
          <Icon name="up" />
          <div>点击或拖拽文件到此处上传</div>
          <div className="hint">支持 .xlsx / .csv，最大 5MB。<a href="/api/import-template" onClick={(e) => e.stopPropagation()}>下载导入模板</a></div>
          <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) preview(f); e.target.value = ''; }} />
        </div>
      )}
      {file && <div className="file"><Icon name="file" /><span style={{ flex: 1 }}>{file.name}</span><span className="t3">{busy ? '处理中…' : res ? `${res.rows.length} 行` : ''}</span></div>}
      {error && <div className="form-err" style={{ marginTop: 12 }}>{error}</div>}
      {res && (
        <>
          <div style={{ margin: '16px 0 8px', display: 'flex', gap: 8, fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{step === 3 ? '导入结果：' : '校验结果：'}</span>
            <Tag tone="green">{step === 3 ? `已导入 ${res.imported} 行` : `${res.ok} 行可导入`}</Tag>
            {res.bad > 0 && <Tag tone="red">{res.bad} 行有误</Tag>}
            {res.skipped > 0 && <Tag tone="gray">{res.skipped} 行已存在</Tag>}
            {res.emails > 0 && <Tag tone="blue">新增 {res.emails} 个邮箱</Tag>}
          </div>
          {bad.length > 0 && (
            <div className="tbl-wrap" style={{ border: '1px solid var(--divider)', borderRadius: 6, maxHeight: 260 }}>
              <table className="tbl compact">
                <thead><tr><th>行</th><th>服务</th><th>登录邮箱</th><th>日期</th><th>问题</th></tr></thead>
                <tbody>{bad.slice(0, 100).map((r) => (
                  <tr key={r.line}><td>{r.line}</td><td>{r.name || '—'}</td><td>{r.email || '—'}</td><td>{r.date || '—'}</td><td>{r.error ? <span style={{ color: 'var(--red)' }}>{r.error}</span> : <span className="t3">{r.skip}</span>}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {step === 2 && <p className="hint" style={{ margin: '8px 0 0' }}>表中没有的邮箱和支付方式会自动新建。有误的行不会导入，可修改后重新上传。</p>}
        </>
      )}
    </Modal>
  );
}

export function ImportButton({ className = 'btn', label = '导入' }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}><Icon name="up" />{label}</button>
      {open && <ImportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function RestoreButton() {
  const { toast, refresh } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => input.current?.click()}>选择备份文件</button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      {file && (
        <Modal title="从备份恢复" onClose={() => setFile(null)} width={480}
          footer={<>
            <button className="btn" onClick={() => setFile(null)}>取消</button>
            <button className="btn btn-primary" disabled={busy} onClick={async () => {
              setBusy(true);
              const r = await post('/api/restore', file);
              setBusy(false);
              if (!r.ok) return toast(r.json.error || '恢复失败', 'err');
              setFile(null);
              toast('已从备份恢复');
              refresh();
            }}>{busy ? '恢复中…' : '确认覆盖'}</button>
          </>}>
          <p style={{ marginTop: 16 }}>将用 <b>{file.name}</b> 覆盖当前全部数据（邮箱、订阅、付费记录、支付方式、备注卡片）。</p>
          <p className="hint">覆盖前会自动把当前数据库备份到服务器的 data/backups 目录。</p>
        </Modal>
      )}
    </>
  );
}
