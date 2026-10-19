import 'server-only';
import { runAs } from '../activity';
import { syncRenewals } from '../queries';
import type { TokenScope } from '../tokens';
import { TOOLS, ToolError } from './tools';

/**
 * 极简 MCP 服务端（Streamable HTTP，无状态）：每个 POST 是一条 JSON-RPC 消息，直接返回 JSON。
 * 只提供 tools 能力，不需要会话和 SSE 推送。
 */

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
export const SERVER_INFO = { name: 'accountlist', title: '账号簿', version: '1.0.0' };

const INSTRUCTIONS = `账号簿：个人的邮箱账号、订阅与到期提醒管理系统。
- 金额单位都是人民币元，日期为 YYYY-MM-DD（北京时间）。
- 先用 get_overview 或 list_todos 了解情况；需要操作具体订阅时，先用 list_subscriptions 找到 id。
- 开启自动续费的订阅过了扣费日会自动顺延并补记付费，不需要手动续费。
- 用户已经在服务方取消了订阅才调用 cancel_subscription；它不会帮用户去服务方取消，可以把 get_subscription 返回的 cancel_guide 和 manage_url 告诉用户。
- 系统不保存任何账号密码，也不要把密码写进备注。`;

interface Rpc {
  jsonrpc?: string;
  id?: string | number | null;
  method?: unknown;
  params?: Record<string, unknown>;
}

const ok = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const fail = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

export function toolList(scope: TokenScope) {
  return TOOLS.filter((t) => scope === 'write' || !t.write).map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: { title: t.title, readOnlyHint: !t.write, destructiveHint: !!t.destructive, idempotentHint: !t.write, openWorldHint: false },
  }));
}

export async function callTool(name: string, args: Record<string, unknown>, scope: TokenScope, who: string) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { error: `没有这个工具：${name}` } as const;
  if (tool.write && scope !== 'write') return { result: { content: [{ type: 'text', text: '这个令牌是只读的，不能修改数据。请在「系统设置 → AI 接入」新建一个可读写的令牌。' }], isError: true } } as const;
  try {
    syncRenewals();
    const data = await runAs(who, () => tool.run(args ?? {}));
    return { result: { content: [{ type: 'text', text: JSON.stringify(data, null, 1) }] } } as const;
  } catch (e) {
    if (e instanceof ToolError) return { result: { content: [{ type: 'text', text: e.message }], isError: true } } as const;
    console.error('[mcp]', name, e);
    return { result: { content: [{ type: 'text', text: `执行出错：${(e as Error).message}` }], isError: true } } as const;
  }
}

/** 处理一条 JSON-RPC 消息；通知（没有 id）返回 null */
export async function handleRpc(msg: Rpc, scope: TokenScope, who: string): Promise<object | null> {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(msg?.id, -32600, 'Invalid Request');
  const isNotification = msg.id === undefined;
  const p = msg.params ?? {};
  let res: object;
  switch (msg.method) {
    case 'initialize': {
      const asked = String(p.protocolVersion ?? '');
      res = ok(msg.id, { protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
      break;
    }
    case 'ping':
      res = ok(msg.id, {});
      break;
    case 'tools/list':
      res = ok(msg.id, { tools: toolList(scope) });
      break;
    case 'tools/call': {
      if (typeof p.name !== 'string') {
        res = fail(msg.id, -32602, '缺少工具名称');
        break;
      }
      const r = await callTool(p.name, (p.arguments as Record<string, unknown>) ?? {}, scope, who);
      res = 'error' in r ? fail(msg.id, -32602, r.error!) : ok(msg.id, r.result);
      break;
    }
    case 'resources/list':
      res = ok(msg.id, { resources: [] });
      break;
    case 'prompts/list':
      res = ok(msg.id, { prompts: [] });
      break;
    default:
      res = msg.method.startsWith('notifications/') ? ok(msg.id, {}) : fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
  return isNotification ? null : res;
}
