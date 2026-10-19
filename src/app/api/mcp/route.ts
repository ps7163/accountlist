import { verifyBearer } from '@/lib/tokens';
import { handleRpc, SERVER_INFO } from '@/lib/mcp/server';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
const unauthorized = () => json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: '未授权：请在请求头加上 Authorization: Bearer <令牌>，令牌在「系统设置 → AI 接入」创建' } }, 401, { 'WWW-Authenticate': 'Bearer realm="accountlist"' });

/** MCP 接口（Streamable HTTP，无状态）。用 API 令牌鉴权 */
export async function POST(req: Request) {
  // 浏览器跨站请求一律拒绝（防 DNS 重绑定）；AI 客户端不带 Origin
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) return json({ error: '来源不被允许' }, 403);

  const token = verifyBearer(req.headers.get('authorization'));
  if (!token) return unauthorized();
  const who = `API 令牌「${token.name}」`;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m, token.scope, who)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202 });
  }
  const res = await handleRpc(body as object, token.scope, who);
  return res ? json(res) : new Response(null, { status: 202 });
}

/** 不提供服务端推送流 */
export function GET() {
  return json({ ...SERVER_INFO, transport: 'streamable-http', hint: '用 POST 发送 JSON-RPC 请求' }, 405, { Allow: 'POST' });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
