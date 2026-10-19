'use client';

import { Fragment, useEffect, useState } from 'react';
import { createApiToken, revokeApiToken } from '@/app/settings-actions';
import { Modal } from '../ui/Modal';
import { Tag } from '../ui/Tag';
import { useApp } from './AppProvider';

export interface TokenRow {
  id: number;
  name: string;
  prefix: string;
  scope: 'read' | 'write';
  createdAt: string;
  lastUsedAt: string | null;
}

/** 数据库里是 UTC 时间，显示成本地时间 */
const local = (s: string | null) => (s ? new Date(`${s.replace(' ', 'T')}Z`).toLocaleString('zh-CN', { hour12: false }).slice(0, -3) : '从未使用');

function Code({ children, label }: { children: string; label: string }) {
  const { toast } = useApp();
  return (
    <div className="code-box">
      <pre className="code" aria-label={label}>{children}</pre>
      <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(children).then(() => toast('已复制'), () => toast('复制失败，请手动选中复制', 'err'))}>复制</button>
    </div>
  );
}

function Guide({ origin, token }: { origin: string; token: string }) {
  const url = `${origin}/api/mcp`;
  const [tab, setTab] = useState<'codex' | 'gemini' | 'cherry' | 'code' | 'json' | 'desktop' | 'cli'>('codex');
  const tabs: [typeof tab, string][] = [['codex', 'Codex'], ['gemini', 'Gemini CLI'], ['cherry', 'Cherry Studio'], ['json', 'Cursor 等'], ['code', 'Claude Code'], ['desktop', 'Claude Desktop'], ['cli', '命令行']];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
      <div className="radios" role="radiogroup" aria-label="客户端">
        {tabs.map(([k, t]) => (
          <Fragment key={k}>
            <input type="radio" name="ai-client" id={`ai-${k}`} checked={tab === k} onChange={() => setTab(k)} />
            <label htmlFor={`ai-${k}`}>{t}</label>
          </Fragment>
        ))}
      </div>
      {tab === 'codex' && (
        <>
          <span className="hint">OpenAI Codex CLI。令牌放在环境变量里（可写进 ~/.zshrc 或 ~/.bashrc），再添加 MCP 服务：</span>
          <Code label="Codex 命令">{`export ACCOUNTLIST_TOKEN=${token}\ncodex mcp add accountlist --url ${url} --bearer-token-env-var ACCOUNTLIST_TOKEN`}</Code>
          <span className="hint">也可以直接编辑 ~/.codex/config.toml：</span>
          <Code label="Codex 配置">{`[mcp_servers.accountlist]\nurl = "${url}"\nbearer_token_env_var = "ACCOUNTLIST_TOKEN"`}</Code>
        </>
      )}
      {tab === 'gemini' && (<><span className="hint">Google Gemini CLI，在 ~/.gemini/settings.json 里添加：</span><Code label="Gemini CLI 配置">{JSON.stringify({ mcpServers: { accountlist: { httpUrl: url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)}</Code></>)}
      {tab === 'cherry' && (
        <>
          <span className="hint">Cherry Studio 可以搭配 DeepSeek、通义千问、GPT 等任意支持工具调用的模型。设置 → MCP 服务器 → 添加服务器，按下面填写：</span>
          <Code label="Cherry Studio 填写">{`类型：可流式传输的 HTTP（streamableHttp）\nURL：${url}\n请求头：Authorization=Bearer ${token}`}</Code>
          <span className="hint">保存后在对话框下方的 MCP 按钮里启用「账号簿」，就可以问「这周有哪些订阅要扣费」。</span>
        </>
      )}
      {tab === 'code' && (<><span className="hint">在终端运行：</span><Code label="Claude Code 命令">{`claude mcp add --transport http accountlist ${url} \\\n  --header "Authorization: Bearer ${token}"`}</Code></>)}
      {tab === 'json' && (<><span className="hint">支持远程 MCP（Streamable HTTP）的客户端，如 Cursor、Windsurf、Cline，在 MCP 配置里添加：</span><Code label="MCP 配置">{JSON.stringify({ mcpServers: { accountlist: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)}</Code></>)}
      {tab === 'desktop' && (
        <>
          <span className="hint">只支持本地 MCP 的客户端通过命令行工具桥接（需要 Node.js 18+）。先下载命令行工具：</span>
          <Code label="下载命令">{`curl -fsSL ${origin}/accountlist.mjs -o ~/accountlist.mjs`}</Code>
          <span className="hint">再编辑 claude_desktop_config.json（设置 → 开发者 → 编辑配置），把路径换成实际位置：</span>
          <Code label="Claude Desktop 配置">{JSON.stringify({ mcpServers: { accountlist: { command: 'node', args: ['/Users/你的用户名/accountlist.mjs', 'mcp'], env: { ACCOUNTLIST_URL: origin, ACCOUNTLIST_TOKEN: token } } } }, null, 2)}</Code>
        </>
      )}
      {tab === 'cli' && (
        <>
          <span className="hint">下载命令行工具（需要 Node.js 18+），AI 编程助手也可以直接调用它：</span>
          <Code label="命令行">{`curl -fsSL ${origin}/accountlist.mjs -o accountlist.mjs\nexport ACCOUNTLIST_URL=${origin}\nexport ACCOUNTLIST_TOKEN=${token}\nnode accountlist.mjs todo          # 待办\nnode accountlist.mjs subs claude   # 搜索订阅\nnode accountlist.mjs help          # 全部命令`}</Code>
        </>
      )}
    </div>
  );
}

export function AiAccess({ tokens }: { tokens: TokenRow[] }) {
  const { run } = useApp();
  const [origin, setOrigin] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write'>('read');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(0);
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <>
      <div className="set">
        <div><h3>MCP 接口</h3><p>让 Codex、Gemini、Cursor、Claude 等 AI 助手查询订阅、到期待办和支出，或帮你录入、续费、标记取消。地址：<code>{origin}/api/mcp</code></p></div>
        <div className="ctl"><button className="btn btn-primary" onClick={() => { setCreating(true); setName(''); setScope('read'); setError(''); setCreated(null); }}>新建令牌</button></div>
      </div>
      <div className="set" style={{ display: 'block' }}>
        {tokens.length ? (
          <div className="tbl-wrap">
            <table className="tbl compact">
              <thead><tr><th>名称</th><th>权限</th><th>令牌</th><th>创建时间</th><th>最近使用</th><th /></tr></thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.scope === 'write' ? <Tag tone="orange">可读写</Tag> : <Tag tone="blue">只读</Tag>}</td>
                    <td className="t3 num">{t.prefix}…</td>
                    <td className="t2">{local(t.createdAt)}</td>
                    <td className="t2">{local(t.lastUsedAt)}</td>
                    <td className="r">
                      {confirm === t.id
                        ? <button className="btn-text danger" onClick={async () => { await run(revokeApiToken(t.id), '令牌已撤销'); setConfirm(0); }}>确认撤销</button>
                        : <button className="btn-text" onClick={() => setConfirm(t.id)}>撤销</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="hint">还没有令牌。新建一个令牌，按提示添加到 AI 客户端即可。</div>}
      </div>
      <div className="set" style={{ display: 'block' }}>
        <details>
          <summary className="t2" style={{ cursor: 'pointer' }}>接入方法</summary>
          <div style={{ paddingTop: 12 }}><Guide origin={origin} token="<令牌>" /></div>
        </details>
      </div>

      {creating && (
        <Modal title={created ? '令牌已创建' : '新建 API 令牌'} onClose={() => setCreating(false)} width={640}
          footer={created
            ? <button className="btn btn-primary" onClick={() => setCreating(false)}>我已保存</button>
            : <>{error && <span className="form-err">{error}</span>}<button className="btn" onClick={() => setCreating(false)}>取消</button><button className="btn btn-primary" form="tok-form">创建</button></>}>
          {created ? (
            <div style={{ paddingTop: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
              <div className="batch" style={{ background: 'var(--orange-bg)', color: 'var(--orange-text)', margin: 0, borderRadius: 6 }}>令牌只显示这一次，请现在复制保存。丢失后撤销再新建即可。</div>
              <Code label="API 令牌">{created}</Code>
              <Guide origin={origin} token={created} />
            </div>
          ) : (
            <form id="tok-form" onSubmit={async (e) => {
              e.preventDefault();
              const r = await createApiToken(name, scope);
              if (!r.ok || !r.token) return setError(r.error || '创建失败');
              setCreated(r.token);
              run(Promise.resolve(r));
            }}>
              <div className="fg" style={{ paddingTop: 16, gridTemplateColumns: '1fr' }}>
                <div className="f"><label htmlFor="tok-name">名称</label><input className="inp" id="tok-name" required maxLength={40} placeholder="如「Codex」「Cherry Studio」" value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="f">
                  <label>权限</label>
                  <div className="radios" role="radiogroup">
                    <input type="radio" name="tok-scope" id="tok-read" checked={scope === 'read'} onChange={() => setScope('read')} /><label htmlFor="tok-read">只读</label>
                    <input type="radio" name="tok-scope" id="tok-write" checked={scope === 'write'} onChange={() => setScope('write')} /><label htmlFor="tok-write">可读写</label>
                  </div>
                  <span className="hint">{scope === 'read' ? '只能查询，适合日常问答。' : '还可以新建、修改、续费、取消和删除（移入回收站）订阅。AI 的每次修改都会记在操作日志里。'}</span>
                </div>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
