'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function PageSize({ size, sizeKey, pageKey }: { size: number; sizeKey: string; pageKey: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <select className="sel" style={{ height: 28 }} aria-label="每页条数" value={size} onChange={(e) => {
      const q = new URLSearchParams(sp.toString());
      q.set(sizeKey, e.target.value);
      q.delete(pageKey);
      router.push(`${path}?${q}`, { scroll: false });
    }}>
      {[10, 20, 50].map((n) => <option key={n} value={n}>{n} 条/页</option>)}
    </select>
  );
}
