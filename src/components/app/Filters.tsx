'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';

/** 修改 URL 查询参数（并回到第一页） */
export function useQueryUpdater(pageKey = 'page') {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (over: Record<string, string>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(over)) (v ? q.set(k, v) : q.delete(k));
    q.delete(pageKey);
    const s = q.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
  };
}

export function SearchBox({ placeholder, name = 'q' }: { placeholder: string; name?: string }) {
  const sp = useSearchParams();
  const update = useQueryUpdater();
  const [v, setV] = useState(sp.get(name) ?? '');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    const h = setTimeout(() => update({ [name]: v.trim() }), 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return (
    <label className="search">
      <Icon name="search" />
      <input type="search" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

export function FilterSelect({ name, label, options }: { name: string; label: string; options: [string, string][] }) {
  const sp = useSearchParams();
  const update = useQueryUpdater();
  return (
    <select className="sel" aria-label={label} value={sp.get(name) ?? ''} onChange={(e) => update({ [name]: e.target.value })}>
      <option value="">{label}</option>
      {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  );
}
