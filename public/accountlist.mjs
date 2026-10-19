#!/usr/bin/env node
// 账号簿命令行工具：查询订阅、到期待办，或作为本地 MCP 服务桥接到账号簿（供 Claude Desktop 等只支持本地 MCP 的客户端使用）。
// 需要 Node.js 18+，无其他依赖。用法：node accountlist.mjs help
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const CONFIG = path.join(os.homedir(), '.config', 'accountlist.json');

const HELP = `账号簿命令行工具

配置（任选其一）：
  node accountlist.mjs login <网址> <令牌>        保存到 ~/.config/accountlist.json
  环境变量 ACCOUNTLIST_URL、ACCOUNTLIST_TOKEN
  参数 --url <网址> --token <令牌>
令牌在网页「系统设置 → AI 接入」创建。

查询：
  overview                 总览
  todo                     待办（快到期、试用快结束、支付卡快过期…）
  subs [关键字]            订阅列表，可加 --group attention|active|trial|ended|once|free
  show <id>                订阅详情（含付费记录、取消步骤）
  upcoming [天数]          未来扣费，默认 30 天
  emails | pays | notes [关键字]
  payments [年份]          付费记录
  spending                 支出分析
  review                   订阅体检（可省多少钱）
  security                 账号安全检查
  log                      操作日志

修改（需要可读写令牌）：
  add name=Claude plan=Pro email=me@gmail.com price=140 cycle=month date=2026-11-20 channel="Apple App Store"
  edit <id> price=150 note="…"     只改传入的字段
  renew <id>               标记已续费
  cancel <id>              标记已取消
  convert <id>             试用转正式
  snooze <id> [天数]       稍后提醒
  usage <id> daily|weekly|monthly|rarely
  delete <id>              移入回收站

通用：
  tools                    列出全部 MCP 工具
  call <工具名> k=v ...    直接调用工具，也可用 --json '{"k":"v"}'
  mcp                      以 stdio MCP 服务运行（桥接到 <网址>/api/mcp）

输出为 JSON，方便脚本和 AI 处理。`;

/* ---------- 参数与配置 ---------- */

const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--') && a.length > 2) {
    const [k, v] = a.slice(2).split(/=(.*)/s);
    flags[k] = v !== undefined ? v : argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  } else pos.push(a);
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  } catch {
    return {};
  }
}

function settings() {
  const c = readConfig();
  const url = (flags.url || process.env.ACCOUNTLIST_URL || c.url || '').replace(/\/+$/, '');
  const token = flags.token || process.env.ACCOUNTLIST_TOKEN || c.token || '';
  if (!url || !token) die('还没有配置网址和令牌。运行 node accountlist.mjs login <网址> <令牌>，或设置 ACCOUNTLIST_URL、ACCOUNTLIST_TOKEN');
  return { url, token };
}

function die(msg, code = 1) {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
}

/** k=v 参数转成对象；true/false 转布尔，其余保持字符串，由服务端校验 */
function kv(list) {
  const out = flags.json ? JSON.parse(flags.json) : {};
  for (const s of list) {
    const i = s.indexOf('=');
    if (i < 1) die(`参数应为 key=value 形式：${s}`);
    const v = s.slice(i + 1);
    out[s.slice(0, i)] = v === 'true' ? true : v === 'false' ? false : v;
  }
  return out;
}

/* ---------- 请求 ---------- */

let seq = 0;
async function post(cfg, body) {
  let res;
  try {
    res = await fetch(`${cfg.url}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (e) {
    throw new Error(`连接 ${cfg.url} 失败：${e.cause?.message || e.message}`);
  }
  if (res.status === 202) return null;
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`服务器返回了非 JSON 内容（HTTP ${res.status}），请检查网址是否正确`);
  }
  if (res.status === 401) throw Object.assign(new Error('令牌无效或已被撤销'), { rpc: json });
  return json;
}

async function rpc(cfg, method, params) {
  const r = await post(cfg, { jsonrpc: '2.0', id: ++seq, method, params });
  if (r.error) throw new Error(r.error.message);
  return r.result;
}

async function callTool(name, args) {
  const cfg = settings();
  const r = await rpc(cfg, 'tools/call', { name, arguments: args });
  const text = (r.content || []).map((c) => c.text).join('\n');
  if (r.isError) die(text);
  try {
    process.stdout.write(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  } catch {
    process.stdout.write(`${text}\n`);
  }
}

/* ---------- stdio MCP 桥接 ---------- */

function bridge() {
  const cfg = settings();
  const send = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
  const rl = readline.createInterface({ input: process.stdin });
  let queue = Promise.resolve();
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
    queue = queue.then(async () => {
      try {
        const r = await post(cfg, msg);
        if (r) send(r);
      } catch (e) {
        process.stderr.write(`[accountlist] ${e.message}\n`);
        if (msg && msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: e.message } });
      }
    });
  });
  rl.on('close', () => queue.then(() => process.exit(0)));
}

/* ---------- 命令 ---------- */

const id = () => {
  if (!/^\d+$/.test(pos[1] || '')) die('请提供订阅 ID，可用 subs 命令查找');
  return Number(pos[1]);
};

const ALIASES = {
  overview: () => ['get_overview', {}],
  todo: () => ['list_todos', {}],
  subs: () => ['list_subscriptions', { ...(pos[1] ? { query: pos.slice(1).join(' ') } : {}), ...(flags.group ? { group: flags.group } : {}), ...(flags.limit ? { limit: flags.limit } : {}) }],
  show: () => ['get_subscription', { id: id() }],
  upcoming: () => ['upcoming_charges', pos[1] ? { days: pos[1] } : {}],
  emails: () => ['list_emails', pos[1] ? { query: pos[1] } : {}],
  pays: () => ['list_pay_methods', {}],
  notes: () => ['list_notes', pos[1] ? { query: pos.slice(1).join(' ') } : {}],
  payments: () => ['list_payments', pos[1] ? { year: pos[1] } : {}],
  spending: () => ['get_spending', {}],
  review: () => ['get_review', {}],
  security: () => ['get_security_risks', {}],
  log: () => ['list_activity', flags.limit ? { limit: flags.limit } : {}],
  add: () => ['save_subscription', kv(pos.slice(1))],
  edit: () => ['save_subscription', { ...kv(pos.slice(2)), id: id() }],
  renew: () => ['renew_subscription', { id: id() }],
  cancel: () => ['cancel_subscription', { id: id() }],
  convert: () => ['convert_trial', { id: id() }],
  snooze: () => ['snooze_subscription', { id: id(), ...(pos[2] ? { days: pos[2] } : {}) }],
  usage: () => ['set_usage', { id: id(), usage: pos[2] ?? '' }],
  delete: () => ['delete_subscription', { id: id() }],
};

async function main() {
  const cmd = pos[0] || 'help';
  if (cmd === 'help' || flags.help || flags.h) return console.log(HELP);
  if (cmd === 'mcp') return bridge();
  if (cmd === 'login') {
    const [, url, token] = pos;
    if (!url || !token) die('用法：node accountlist.mjs login <网址> <令牌>');
    const cfg = { url: url.replace(/\/+$/, ''), token };
    const init = await rpc(cfg, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'accountlist-cli', version: '1.0.0' } });
    const { tools } = await rpc(cfg, 'tools/list', {});
    fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
    fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), { mode: 0o600 });
    fs.chmodSync(CONFIG, 0o600);
    return console.log(`已连接 ${init.serverInfo?.title || '账号簿'}，可用 ${tools.length} 个工具${tools.some((t) => !t.annotations?.readOnlyHint) ? '' : '（只读令牌）'}。配置已保存到 ${CONFIG}`);
  }
  if (cmd === 'tools') {
    const { tools } = await rpc(settings(), 'tools/list', {});
    for (const t of tools) console.log(`${t.name.padEnd(22)} ${t.annotations?.readOnlyHint ? '' : '[写] '}${t.description}`);
    return;
  }
  if (cmd === 'call') {
    if (!pos[1]) die('用法：node accountlist.mjs call <工具名> key=value ...');
    return callTool(pos[1], kv(pos.slice(2)));
  }
  const alias = ALIASES[cmd];
  if (!alias) die(`未知命令：${cmd}\n运行 node accountlist.mjs help 查看用法`);
  const [name, args] = alias();
  return callTool(name, args);
}

main().catch((e) => die(e.message));
