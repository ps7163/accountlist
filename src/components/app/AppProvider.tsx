'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../icons';
import { SubForm, type SubFormInitial } from './SubForm';
import { DetailDrawer } from './DetailDrawer';
import { CancelFlow } from './CancelFlow';
import { NoteForm, type NoteInitial } from './NoteForm';

export interface EmailOption {
  id: number;
  address: string;
  provider: string;
}
export interface PayOption {
  id: number;
  name: string;
  type: string;
}
export interface SubOption {
  id: number;
  name: string;
  plan: string;
  emailAddress: string;
}
export interface ShellData {
  emails: EmailOption[];
  payMethods: PayOption[];
  subOptions: SubOption[];
  remindDays: number;
}

interface AppApi {
  data: ShellData;
  toast: (msg: string, tone?: 'ok' | 'err') => void;
  refresh: () => void;
  openNew: (preset?: Partial<SubFormInitial>) => void;
  openEdit: (id: number) => void;
  openDetail: (id: number) => void;
  openCancel: (id: number) => void;
  openNote: (n?: NoteInitial) => void;
  /** 调用服务端操作，失败时提示错误，成功后刷新页面 */
  run: <T extends { ok: boolean; error?: string }>(p: Promise<T>, okMsg?: string | ((r: T) => string)) => Promise<T | null>;
}

const Ctx = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

export function AppProvider({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const router = useRouter();
  const [toastMsg, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [form, setForm] = useState<{ editId?: number; preset?: Partial<SubFormInitial> } | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [note, setNote] = useState<NoteInitial | null>(null);
  const [detailKey, setDetailKey] = useState(0);

  const tipRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const el = tipRef.current;
      if (!el) return;
      const t = (e.target as Element | null)?.closest?.('[data-tip]');
      if (!t) return void (el.hidden = true);
      const parts = (t.getAttribute('data-tip') || '').split('｜');
      el.replaceChildren(...parts.map((x, i) => Object.assign(document.createElement(i ? 'div' : 'b'), { textContent: x })));
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      el.hidden = false;
    };
    document.addEventListener('mousemove', move);
    return () => document.removeEventListener('mousemove', move);
  }, []);
  const toast = useCallback((msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  const refresh = useCallback(() => {
    router.refresh();
    setDetailKey((k) => k + 1);
  }, [router]);
  const run = useCallback(
    async <T extends { ok: boolean; error?: string }>(p: Promise<T>, okMsg?: string | ((r: T) => string)) => {
      try {
        const r = await p;
        if (!r.ok) {
          toast(r.error || '操作失败', 'err');
          return null;
        }
        if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
        refresh();
        return r;
      } catch {
        toast('网络异常或登录已过期，请刷新页面后重试', 'err');
        return null;
      }
    },
    [toast, refresh],
  );

  const api = useMemo<AppApi>(
    () => ({
      data,
      toast,
      refresh,
      run,
      openNew: (preset) => setForm({ preset }),
      openEdit: (id) => setForm({ editId: id }),
      openDetail: (id) => setDetailId(id),
      openCancel: (id) => setCancelId(id),
      openNote: (n) => setNote(n ?? {}),
    }),
    [data, toast, refresh, run],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {detailId !== null && <DetailDrawer id={detailId} reloadKey={detailKey} onClose={() => setDetailId(null)} />}
      {form && <SubForm editId={form.editId} preset={form.preset} onClose={() => setForm(null)} />}
      {cancelId !== null && <CancelFlow id={cancelId} onClose={() => setCancelId(null)} />}
      {note && <NoteForm initial={note} onClose={() => setNote(null)} />}
      <div className="tip" ref={tipRef} hidden />
      {toastMsg && (
        <div className="toast" role="status">
          <Icon name={toastMsg.tone === 'ok' ? 'ok' : 'warn'} className={`i ${toastMsg.tone === 'err' ? 'err' : ''}`} />
          {toastMsg.msg}
        </div>
      )}
    </Ctx.Provider>
  );
}
