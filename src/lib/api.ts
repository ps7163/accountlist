import 'server-only';
import { headers } from 'next/headers';
import { isAuthenticated } from './auth';

/** API 路由鉴权；写操作额外校验来源，防止跨站请求 */
export async function apiGuard(write = false): Promise<Response | null> {
  if (!(await isAuthenticated())) return Response.json({ error: '请先登录' }, { status: 401 });
  if (write) {
    const h = await headers();
    const origin = h.get('origin');
    const host = h.get('x-forwarded-host') || h.get('host');
    if (origin && host && new URL(origin).host !== host) return Response.json({ error: '来源不被允许' }, { status: 403 });
  }
  return null;
}

export function download(body: BodyInit, filename: string, type: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, 'Cache-Control': 'no-store' },
  });
}
