import crypto from 'node:crypto';
import { getSetting } from '@/lib/settings';
import { buildIcs } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** 日历订阅地址：日历 App 无法登录，用随机令牌鉴权，可在设置里重置 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const expected = getSetting('ics_token');
  const given = token.replace(/\.ics$/, '');
  if (!expected || given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(buildIcs(), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } });
}
