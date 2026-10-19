# 账号簿

个人用的邮箱、订阅与到期提醒管理系统：记录每个邮箱注册了哪些服务、怎么付费、什么时候扣费，到期前提醒你。数据保存在你自己的服务器上。

设计原型见 [`docs/prototype.html`](docs/prototype.html)。

## 功能

- **工作台**：待办（到期、过期、试用快结束、支付卡快过期），支持「已续费 / 不续了 / 保留 / 稍后提醒」；即将扣费、支出分析（近 12 个月柱状图、分类构成）、试用中、按邮箱汇总
- **订阅管理**：搜索、按邮箱 / 渠道 / 分类 / 状态筛选、分页、批量续费 / 取消 / 删除；详情抽屉含付费记录、按渠道生成的取消步骤、备注卡片
- **新建订阅**：常用服务模板一键填写；支持订阅 / 一次性买断 / 免费仅注册、免费试用、自动续费
- **邮箱账号**：绑定手机（默认打码）、辅助邮箱、服务数与月支出
- **支付方式**：卡片有效期、绑定了哪些订阅，60 天内到期提醒
- **备注卡片**：给邮箱或服务记录取消方法、发票、共享成员等
- **账号安全**：自动检查辅助邮箱缺失、互为辅助、共用手机号、一键登录依赖、未开两步验证；找回关系图；邮箱影响面
- **扣费日历**、**付费记录**（按年统计）
- **提醒**：页面提醒；日历订阅（iPhone / Google / 飞书日历）；飞书机器人每日推送
- **数据**：Excel / CSV 导入（带校验预览）、Excel / CSV / JSON 导出、JSON 备份恢复、每天自动备份数据库（保留 30 天）
- **安全**：单用户密码登录（scrypt 哈希）、可选两步验证（TOTP）、登录失败限流、一键退出其他设备。系统不保存任何账号密码
- **订阅体检**：找出「花得多、用得少」的订阅并算出一年可省多少；同一服务多处付费、同类订阅、近期涨价、资料缺失一目了然；每 90 天提醒一次
- **价格变动记录**：修改金额时自动记录，列表和详情里标出涨价
- **月度预算**：超出预算时工作台提醒，新建订阅时提示还剩多少
- **全局搜索**：⌘K / Ctrl+K 搜索订阅、邮箱、支付方式、卡片和常用操作
- **回收站**：删除的订阅、邮箱、支付方式、卡片保留 30 天，可恢复（连同付费记录和卡片）
- **操作日志**：新建、编辑、续费、删除、登录、导入导出等操作都有记录，保留一年
- **AI 接入**：内置 MCP 接口和命令行工具，Claude、Cursor 等 AI 助手可以查询订阅和待办，也可以帮你录入、续费、标记取消（见下文）
- **添加到手机主屏幕**：iPhone 用 Safari「分享 → 添加到主屏幕」，安卓用 Chrome「安装应用」
- 6 款顶部皮肤，深色模式，手机端适配

自动续费的订阅过了扣费日会自动顺延到下一期，并补记付费记录。月付订阅遇到小月按月末扣费（如 31 号订阅在 2 月按 28/29 号）。所有日期按北京时间计算，金额统一为人民币。

## 部署（Docker，x86 服务器）

需要 Docker 和 Docker Compose。

```bash
git clone https://github.com/ps7163/accountlist.git
cd accountlist
docker compose up -d --build
```

浏览器打开 `http://服务器IP:3000`，首次访问会让你设置登录密码。

数据保存在仓库目录下的 `data/`：

| 路径 | 说明 |
|---|---|
| `data/accountlist.db` | 数据库 |
| `data/backups/` | 每天自动备份，保留最近 30 份 |

### 建议：配置 HTTPS

账号数据较敏感，建议只通过 HTTPS 访问，并在服务器防火墙里不要对外开放 3000 端口。用 [Caddy](https://caddyserver.com/) 最简单（自动申请证书）：

```
acct.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Nginx 示例：

```nginx
server {
    listen 443 ssl;
    server_name acct.example.com;
    # ssl_certificate ...; ssl_certificate_key ...;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

通过 HTTPS 访问时，登录 Cookie 会根据 `X-Forwarded-Proto` 自动加上 `Secure`。只想本机访问时，可把 `docker-compose.yml` 里的端口改成 `"127.0.0.1:3000:3000"`。

### 更新

```bash
git pull
docker compose up -d --build
```

数据库结构变化会在启动时自动迁移，旧数据会保留。更新前可以在「系统设置 → 数据」导出一份 JSON 备份。

### 忘记密码

清除密码和两步验证后，重新打开网页会进入「设置密码」页面（数据不受影响）：

```bash
docker compose exec accountlist node -e "new (require('better-sqlite3'))('/app/data/accountlist.db').prepare(\"delete from settings where key in ('password_hash','totp_secret')\").run()"
```

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 监听端口 |
| `DATA_DIR` | `/app/data` | 数据目录 |
| `TZ` | `Asia/Shanghai` | 容器时区 |
| `COOKIE_SECURE` | 自动 | `true` 强制 Secure Cookie；`false` 强制关闭 |

## 使用提示

- **批量导入**：系统设置 → 数据 → 下载模板。模板有「邮箱」「订阅」两张表，带 * 的列必填；表中没有的邮箱和支付方式会自动新建，已存在的订阅（同名、同档位、同邮箱）会跳过。
- **日历订阅**：系统设置 → 提醒 → 复制日历订阅链接，在手机日历里添加订阅。每个扣费日提前 1 天和「提前提醒天数」各提醒一次。链接相当于钥匙，泄露后可以在设置里重置。
- **飞书推送**：飞书群设置 → 群机器人 → 添加「自定义机器人」，把 Webhook 地址填到系统设置里。如果机器人开启了「签名校验」，同时填写签名密钥。没有待办的日子不会推送。

## AI 接入（MCP / 命令行）

先在「系统设置 → AI 接入」新建一个 API 令牌。**只读**令牌只能查询；**可读写**令牌还能新建、修改、续费、取消和删除（移入回收站）订阅。令牌只显示一次，数据库里只保存哈希；AI 做的每次修改都会记在操作日志里，并标明是哪个令牌。不用了随时可以撤销。

MCP 地址是 `https://你的域名/api/mcp`（Streamable HTTP，用 `Authorization: Bearer <令牌>` 鉴权）。

**Claude Code**

```bash
claude mcp add --transport http accountlist https://acct.example.com/api/mcp \
  --header "Authorization: Bearer al_xxx"
```

**Cursor、Cherry Studio 等支持远程 MCP 的客户端**

```json
{ "mcpServers": { "accountlist": { "url": "https://acct.example.com/api/mcp", "headers": { "Authorization": "Bearer al_xxx" } } } }
```

**Claude Desktop 等只支持本地 MCP 的客户端**：用命令行工具桥接（需要 Node.js 18+）。

```bash
curl -fsSL https://acct.example.com/accountlist.mjs -o ~/accountlist.mjs
```

```json
{
  "mcpServers": {
    "accountlist": {
      "command": "node",
      "args": ["/Users/你的用户名/accountlist.mjs", "mcp"],
      "env": { "ACCOUNTLIST_URL": "https://acct.example.com", "ACCOUNTLIST_TOKEN": "al_xxx" }
    }
  }
}
```

**命令行**：同一个文件也是命令行工具，输出 JSON，适合脚本或让 AI 编程助手直接调用。

```bash
node accountlist.mjs login https://acct.example.com al_xxx   # 保存到 ~/.config/accountlist.json
node accountlist.mjs todo                  # 待办
node accountlist.mjs subs claude           # 搜索订阅
node accountlist.mjs upcoming 60           # 未来 60 天扣费
node accountlist.mjs add name=Claude plan=Pro email=me@gmail.com price=140 cycle=month date=2026-11-20 channel="Apple App Store"
node accountlist.mjs renew 12              # 标记已续费
node accountlist.mjs help                  # 全部命令
```

提供的工具：

| 查询 | 修改（需要可读写令牌） |
|---|---|
| `get_overview` 总览、`list_todos` 待办、`upcoming_charges` 即将扣费 | `save_subscription` 新建或修改订阅（修改时只传要改的字段） |
| `list_subscriptions` 订阅列表、`get_subscription` 详情（含取消步骤） | `renew_subscription` 已续费、`cancel_subscription` 已取消、`convert_trial` 试用转正式 |
| `list_emails`、`list_pay_methods`、`list_notes`、`list_payments` | `snooze_subscription` 稍后提醒、`set_usage` 使用频率、`add_payment` 补记付费 |
| `get_spending` 支出分析、`get_review` 订阅体检、`get_security_risks` 账号安全、`list_activity` 操作日志 | `delete_subscription` 移入回收站、`save_email`、`save_pay_method`、`save_note` |

手机号默认打码返回。claude.ai 网页版的「自定义连接器」需要 OAuth 登录，暂不支持。

## 本地开发

```bash
npm ci
npm run dev        # http://localhost:3000，数据在 ./data
npm test           # 计费与日期规则的单元测试
npm run lint       # 类型检查
npm run db:generate  # 修改 src/lib/db/schema.ts 后生成迁移
```

技术栈：Next.js 15（App Router）、React 19、SQLite（better-sqlite3 + Drizzle ORM）、ExcelJS。
