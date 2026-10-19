'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '../icons';

function useEsc(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

interface Props {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

/** 居中弹窗（手机上为底部弹出） */
export function Modal({ title, onClose, children, footer, width = 680 }: Props) {
  useEsc(onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea,button')?.focus({ preventScroll: true }), []);
  return (
    <>
      <div className="mask" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" style={{ width: `min(${width}px, calc(100% - 32px))` }} ref={ref}>
        <div className="dr-h">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="x" />
          </button>
        </div>
        <div className="md-b">{children}</div>
        {footer && <div className="dr-f">{footer}</div>}
      </div>
    </>
  );
}

/** 右侧抽屉（手机上为底部弹出） */
export function Drawer({ title, onClose, children, footer }: Props) {
  useEsc(onClose);
  return (
    <>
      <div className="mask" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="dr-h">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="x" />
          </button>
        </div>
        <div className="dr-b">{children}</div>
        {footer && <div className="dr-f">{footer}</div>}
      </aside>
    </>
  );
}

