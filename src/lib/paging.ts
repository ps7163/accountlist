export type Search = Record<string, string | string[] | undefined>;

export function param(sp: Search, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export function paginate<T>(rows: T[], pageRaw: string, sizeRaw: string, defSize = 10) {
  const size = [5, 10, 20, 50].includes(Number(sizeRaw)) ? Number(sizeRaw) : defSize;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(pageRaw)) || 1));
  return { items: rows.slice((page - 1) * size, page * size), page, size, pages, total: rows.length };
}
export type Paged<T> = ReturnType<typeof paginate<T>>;

/** 基于当前查询参数生成链接；值为空字符串的参数会被去掉 */
export function hrefWith(path: string, sp: Search, over: Record<string, string | number | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) q.set(k, s);
  }
  for (const [k, v] of Object.entries(over)) {
    if (v === null || v === '') q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
