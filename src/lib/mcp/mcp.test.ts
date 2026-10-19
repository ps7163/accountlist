import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'accountlist-mcp-'));
process.env.DATA_DIR = dir;

type Mod = typeof import('./server');
let rpc: Mod['handleRpc'];
let tokens: typeof import('../tokens');

beforeAll(async () => {
  rpc = (await import('./server')).handleRpc;
  tokens = await import('../tokens');
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

let n = 0;
async function call(name: string, args: Record<string, unknown> = {}, scope: 'read' | 'write' = 'write') {
  const r = (await rpc({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }, scope, 'API 令牌「测试」')) as { result: { content: { text: string }[]; isError?: boolean } };
  const text = r.result.content[0].text;
  return { isError: !!r.result.isError, text, data: r.result.isError ? null : JSON.parse(text) };
}

describe('MCP 协议', () => {
  it('initialize 协商协议版本', async () => {
    const r = (await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, 'read', 'x')) as { result: { protocolVersion: string; capabilities: object } };
    expect(r.result.protocolVersion).toBe('2025-03-26');
    expect(r.result.capabilities).toHaveProperty('tools');
    const r2 = (await rpc({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, 'read', 'x')) as { result: { protocolVersion: string } };
    expect(r2.result.protocolVersion).toBe('2025-06-18');
  });

  it('通知不返回，未知方法报错', async () => {
    expect(await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, 'read', 'x')).toBeNull();
    expect(await rpc({ jsonrpc: '2.0', id: 3, method: 'nope' }, 'read', 'x')).toMatchObject({ error: { code: -32601 } });
    expect(await rpc({ id: 4, method: 'ping' }, 'read', 'x')).toMatchObject({ error: { code: -32600 } });
  });

  it('只读令牌看不到也调不了写工具', async () => {
    const ro = (await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/list' }, 'read', 'x')) as { result: { tools: { name: string }[] } };
    const rw = (await rpc({ jsonrpc: '2.0', id: 6, method: 'tools/list' }, 'write', 'x')) as { result: { tools: { name: string }[] } };
    expect(ro.result.tools.map((t) => t.name)).not.toContain('save_subscription');
    expect(rw.result.tools.map((t) => t.name)).toContain('save_subscription');
    const r = await call('save_subscription', { name: 'X' }, 'read');
    expect(r.isError).toBe(true);
  });
});

describe('MCP 工具', () => {
  let id = 0;
  it('新建订阅时自动添加邮箱和支付方式', async () => {
    const r = await call('save_subscription', { name: 'Claude', plan: 'Pro', email: 'Me@Example.com', price: 140, cycle: 'month', date: '2099-01-31', channel: 'Apple App Store', pay_method: '招行信用卡 尾号 1234' });
    expect(r.isError).toBe(false);
    expect(r.data.created_email).toBe(true);
    expect(r.data.subscription).toMatchObject({ name: 'Claude', email: 'me@example.com', price: 140, pay_method: '招行信用卡 尾号 1234', monthly_cost: 140 });
    id = r.data.subscription.id;
  });

  it('参数错误返回 isError', async () => {
    expect((await call('save_subscription', { name: 'Y', email: 'me@example.com', date: '2099-01-01' })).text).toContain('金额');
    expect((await call('get_subscription', { id: 9999 })).isError).toBe(true);
  });

  it('只改传入的字段，并记录价格变动', async () => {
    const r = await call('save_subscription', { id, price: '150' });
    expect(r.data.action).toBe('updated');
    expect(r.data.subscription).toMatchObject({ plan: 'Pro', price: 150, channel: 'Apple App Store', next_date: '2099-01-31', pay_method: '招行信用卡 尾号 1234' });
    const d = await call('get_subscription', { id });
    expect(d.data.price_changes).toEqual([expect.objectContaining({ old: 140, new: 150 })]);
    expect(d.data.cancel_guide.length).toBeGreaterThan(0);
  });

  it('查询、续费、取消', async () => {
    expect((await call('list_subscriptions', { query: 'claude' })).data.total).toBe(1);
    expect((await call('list_subscriptions', { group: 'trial' })).data.total).toBe(0);
    const renew = await call('renew_subscription', { id });
    expect(renew.data.next_date).toBe('2099-02-28');
    expect((await call('list_payments', { subscription_id: id })).data.items[0].amount).toBe(150);
    expect((await call('cancel_subscription', { id })).isError).toBe(false);
    expect((await call('get_subscription', { id })).data).toMatchObject({ status: 'cancelled', auto_renew: false });
  });

  it('总览、待办、支出等只读工具都能运行', async () => {
    for (const name of ['get_overview', 'list_todos', 'upcoming_charges', 'list_emails', 'list_pay_methods', 'list_notes', 'get_spending', 'get_review', 'get_security_risks', 'list_activity']) {
      const r = await call(name);
      expect(r.isError, name).toBe(false);
    }
    expect((await call('list_emails')).data[0].address).toBe('me@example.com');
  });

  it('操作日志标明来自哪个令牌', async () => {
    const log = (await call('list_activity', { limit: 3 })).data as { action: string; detail: string }[];
    expect(log[0]).toMatchObject({ action: '取消订阅' });
    expect(log[0].detail).toContain('API 令牌「测试」');
  });

  it('备注卡片', async () => {
    const r = await call('save_note', { target_type: 'sub', target_id: id, title: '取消方法', body: '在 iPhone 设置里取消' });
    expect(r.isError).toBe(false);
    const u = await call('save_note', { id: r.data.id, pinned: true });
    expect(u.isError).toBe(false);
    expect((await call('list_notes', { query: 'iphone' })).data.items[0]).toMatchObject({ title: '取消方法', pinned: true, target: 'Claude Pro' });
  });
});

describe('API 令牌', () => {
  it('只认正确的 Bearer 令牌，撤销后失效', () => {
    const { id, token } = tokens.createToken('测试', 'read');
    expect(tokens.verifyBearer(`Bearer ${token}`)).toMatchObject({ name: '测试', scope: 'read' });
    expect(tokens.verifyBearer(token)).toBeNull();
    expect(tokens.verifyBearer(`Bearer ${token}x`)).toBeNull();
    expect(tokens.listTokens()[0]).toMatchObject({ prefix: token.slice(0, 7) });
    expect(JSON.stringify(tokens.listTokens())).not.toContain(token);
    tokens.revokeToken(id);
    expect(tokens.verifyBearer(`Bearer ${token}`)).toBeNull();
  });
});
