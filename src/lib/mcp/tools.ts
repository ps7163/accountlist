import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../db';
import { CYCLE_LABEL, formatYuan, isValidDate, projectedDates, today, addDays, type Cycle } from '../billing';
import { CATEGORIES, CHANNELS, GUIDES, LOGINS, MFAS, NOTE_COLORS, USAGES, maskPhone } from '../constants';
import { expiringPayMethods, listEmails, listNotes, listPayMethods, listPayments, listSubs, notesOf, paymentsOf, priceChangesOf, type SubView } from '../queries';
import { buildReview, reviewDue } from '../review';
import { securityRisks } from '../security';
import { getPrefs, getSetting } from '../settings';
import * as ops from '../ops';

/* ---------------- 工具定义 ---------------- */

type Json = Record<string, unknown>;
export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  write: boolean;
  destructive?: boolean;
  run: (a: Json) => Promise<unknown> | unknown;
}

/** 参数错误或操作失败，作为 isError 结果返回给 AI */
export class ToolError extends Error {}

const yuan = (cents: number) => Math.round(cents) / 100;
const obj = (properties: Json, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const P = {
  id: { type: 'integer', description: '订阅 ID（来自 list_subscriptions）' },
  limit: (d: number, max: number) => ({ type: 'integer', minimum: 1, maximum: max, default: d, description: `返回条数，默认 ${d}，最多 ${max}` }),
  offset: { type: 'integer', minimum: 0, default: 0, description: '跳过前多少条，用于翻页' },
  date: (desc: string) => ({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: `${desc}，格式 YYYY-MM-DD` }),
};

function int(a: Json, k: string, opts: { def?: number; min?: number; max?: number; required?: boolean } = {}): number {
  const v = a[k];
  if (v === undefined || v === null || v === '') {
    if (opts.required) throw new ToolError(`缺少参数 ${k}`);
    return opts.def ?? 0;
  }
  const n = Number(v);
  if (!Number.isInteger(n)) throw new ToolError(`参数 ${k} 应为整数`);
  return Math.min(opts.max ?? Infinity, Math.max(opts.min ?? -Infinity, n));
}
const text = (a: Json, k: string) => (a[k] === undefined || a[k] === null ? undefined : String(a[k]));
const bool = (a: Json, k: string) => (a[k] === undefined || a[k] === null ? undefined : a[k] === true || a[k] === 'true' || a[k] === 1);
function check<T extends { ok: boolean; error?: string }>(r: T): T {
  if (!r.ok) throw new ToolError(r.error || '操作失败');
  return r;
}
function page<T>(rows: T[], a: Json, def: number, max: number) {
  const limit = int(a, 'limit', { def, min: 1, max });
  const offset = int(a, 'offset', { def: 0, min: 0 });
  return { total: rows.length, offset, count: Math.min(limit, Math.max(0, rows.length - offset)), items: rows.slice(offset, offset + limit) };
}

function subRow(s: SubView) {
  return {
    id: s.id,
    name: s.name,
    plan: s.plan,
    category: s.category,
    email: s.emailAddress,
    kind: s.kind,
    price: yuan(s.priceCents),
    cycle: s.kind === 'sub' ? s.cycle : null,
    next_date: s.nextDate,
    trial_end: s.trialEnd,
    auto_renew: s.autoRenew,
    status: s.status,
    state: s.state.label,
    needs_attention: s.state.alert,
    days_left: s.state.days,
    channel: s.channel,
    pay_method: s.payName,
    monthly_cost: yuan(s.monthlyCents),
    usage: s.usage,
    manage_url: s.manageUrl,
    note: s.note.length > 120 ? `${s.note.slice(0, 120)}…` : s.note,
  };
}

function findSub(id: number): SubView {
  const s = listSubs().find((x) => x.id === id);
  if (!s) throw new ToolError(`订阅 ${id} 不存在（可能已删除）`);
  return s;
}

/** 按地址或 ID 找邮箱 */
function findEmail(v: string) {
  const list = listEmails();
  const e = /^\d+$/.test(v) ? list.find((x) => x.id === Number(v)) : list.find((x) => x.address === v.trim().toLowerCase());
  return e ?? null;
}

const GROUPS: Record<string, (s: SubView) => boolean> = {
  all: () => true,
  attention: (s) => s.state.alert,
  active: (s) => s.state.group === 'active',
  trial: (s) => s.state.group === 'trial',
  ended: (s) => s.state.group === 'ended',
  once: (s) => s.state.group === 'once',
  free: (s) => s.state.group === 'free',
};

const SUB_FIELDS = {
  name: { type: 'string', description: '服务名称，如 ChatGPT、Claude、iCloud+' },
  plan: { type: 'string', description: '订阅档位，如 Plus、Pro、200GB' },
  category: { type: 'string', enum: CATEGORIES },
  email: { type: 'string', description: '注册用的邮箱地址（不存在时自动添加）或邮箱 ID' },
  kind: { type: 'string', enum: ['sub', 'once', 'free'], description: 'sub=周期订阅，once=一次性买断，free=免费仅注册' },
  price: { type: 'number', minimum: 0, description: '每期金额，人民币元' },
  cycle: { type: 'string', enum: ['week', 'month', 'quarter', 'year'], description: '扣费周期' },
  date: P.date('订阅：下次扣费日（试用时为试用结束日）；买断：购买日；免费可不填'),
  trial: { type: 'boolean', description: '是否在免费试用中' },
  auto_renew: { type: 'boolean', description: '是否自动续费' },
  status: { type: 'string', enum: ['active', 'cancelled', 'expired'] },
  channel: { type: 'string', description: `付费渠道，常用：${CHANNELS.join('、')}` },
  pay_method: { type: 'string', description: '支付方式名称，如「招行信用卡 尾号 1234」；不存在时自动添加；传空字符串表示不指定' },
  url: { type: 'string', description: '服务网址' },
  manage_url: { type: 'string', description: '管理订阅 / 取消订阅的链接' },
  login: { type: 'string', enum: Object.keys(LOGINS), description: Object.entries(LOGINS).map(([k, v]) => `${k}=${v}`).join('，') },
  mfa: { type: 'string', enum: Object.keys(MFAS), description: Object.entries(MFAS).map(([k, v]) => `${k}=${v}`).join('，') },
  usage: { type: 'string', enum: Object.keys(USAGES), description: Object.entries(USAGES).map(([k, v]) => `${k || '空'}=${v}`).join('，') },
  note: { type: 'string', description: '备注' },
};

async function saveSub(a: Json) {
  const id = int(a, 'id');
  const old = id ? findSub(id) : null;
  let createdEmail = false;
  let emailId = old?.emailId ?? 0;
  const emailArg = text(a, 'email');
  if (emailArg !== undefined) {
    const e = findEmail(emailArg);
    if (e) emailId = e.id;
    else if (/^\d+$/.test(emailArg)) throw new ToolError(`邮箱 ${emailArg} 不存在`);
    else {
      emailId = check(await ops.saveEmail({ address: emailArg, phone: '', recovery: '', note: '' })).id!;
      createdEmail = true;
    }
  }
  if (!emailId) throw new ToolError('请提供 email（注册用的邮箱地址）');

  let payMethodId = old?.payMethodId ?? null;
  let newPayName = '';
  const payArg = text(a, 'pay_method');
  if (payArg !== undefined) {
    const name = payArg.trim();
    const p = name ? listPayMethods().find((x) => x.name.toLowerCase() === name.toLowerCase()) : null;
    payMethodId = p ? p.id : null;
    newPayName = p ? '' : name;
  }

  const price = a.price ?? (old ? old.priceCents / 100 : undefined);
  const r = check(
    await ops.saveSubscription({
      id: old?.id,
      name: text(a, 'name') ?? old?.name ?? '',
      plan: text(a, 'plan') ?? old?.plan ?? '',
      category: text(a, 'category') ?? old?.category ?? '其他',
      emailId,
      kind: (text(a, 'kind') ?? old?.kind ?? 'sub') as 'sub' | 'once' | 'free',
      price: price === undefined ? '' : String(price),
      cycle: (text(a, 'cycle') ?? old?.cycle ?? 'month') as Cycle,
      date: text(a, 'date') ?? old?.trialEnd ?? old?.nextDate ?? '',
      trial: bool(a, 'trial') ?? !!old?.trialEnd,
      autoRenew: bool(a, 'auto_renew') ?? old?.autoRenew ?? true,
      status: (text(a, 'status') ?? old?.status ?? 'active') as 'active' | 'cancelled' | 'expired',
      channel: text(a, 'channel') ?? old?.channel ?? '',
      payMethodId,
      newPayName,
      url: text(a, 'url') ?? old?.url ?? '',
      manageUrl: text(a, 'manage_url') ?? old?.manageUrl ?? '',
      login: text(a, 'login') ?? old?.login ?? 'password',
      mfa: text(a, 'mfa') ?? old?.mfa ?? 'none',
      usage: text(a, 'usage') ?? old?.usage ?? '',
      note: text(a, 'note') ?? old?.note ?? '',
    }),
  );
  return { ok: true, action: old ? 'updated' : 'created', created_email: createdEmail || undefined, subscription: subRow(findSub(r.id!)) };
}

function todos() {
  const t = today();
  const prefs = getPrefs();
  const subs = listSubs();
  const monthly = subs.reduce((x, s) => x + s.monthlyCents, 0);
  const items: Json[] = [];
  if (prefs.budgetCents > 0 && monthly > prefs.budgetCents) items.push({ type: 'budget', message: `每月订阅 ${formatYuan(monthly)}，超出预算 ${formatYuan(monthly - prefs.budgetCents)}` });
  for (const s of subs.filter((x) => x.state.alert).sort((x, y) => (x.state.days ?? 0) - (y.state.days ?? 0))) {
    items.push({
      type: s.trialEnd ? 'trial_ending' : (s.state.days ?? 0) < 0 ? 'overdue' : 'due_soon',
      subscription_id: s.id,
      name: `${s.name} ${s.plan}`.trim(),
      email: s.emailAddress,
      state: s.state.label,
      date: s.trialEnd ?? s.nextDate,
      price: yuan(s.priceCents),
      channel: s.channel,
      auto_renew: s.autoRenew,
      manage_url: s.manageUrl,
      actions: s.trialEnd ? ['convert_trial', 'cancel_subscription', 'snooze_subscription'] : ['renew_subscription', 'cancel_subscription', 'snooze_subscription'],
    });
  }
  for (const p of expiringPayMethods(listPayMethods(), t)) {
    items.push({ type: 'pay_method_expiring', pay_method_id: p.id, name: p.name, expire_month: p.expireMonth, subscriptions: subs.filter((s) => s.payMethodId === p.id && s.status === 'active').map((s) => `${s.name} ${s.plan}`.trim()) });
  }
  if (reviewDue(getSetting('last_review'), subs, t)) items.push({ type: 'review_due', message: '已经 90 天没做订阅体检了，可以调用 get_review 查看建议' });
  const snoozed = subs.filter((s) => s.snoozeUntil && s.snoozeUntil > t && s.status === 'active').map((s) => ({ subscription_id: s.id, name: `${s.name} ${s.plan}`.trim(), until: s.snoozeUntil }));
  return { today: t, remind_days: prefs.remindDays, count: items.length, items, snoozed };
}

function spending() {
  const t = today();
  const prefs = getPrefs();
  const subs = listSubs();
  const pays = listPayments();
  const live = subs.filter((s) => s.kind === 'sub' && s.status === 'active');
  const monthly = subs.reduce((x, s) => x + s.monthlyCents, 0);
  const [cy, cm] = [Number(t.slice(0, 4)), Number(t.slice(5, 7))];
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(cy, cm - 12 + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { month: key, paid: yuan(pays.filter((p) => p.date.startsWith(key) && p.date <= t).reduce((x, p) => x + p.amountCents, 0)) };
  });
  const key = t.slice(0, 7);
  const dueThisMonth = live.reduce((x, s) => x + projectedDates(s, `${key}-01`, `${key}-31`, t).length * s.priceCents, 0);
  const byCat = new Map<string, number>();
  for (const s of subs) if (s.monthlyCents) byCat.set(s.category, (byCat.get(s.category) ?? 0) + s.monthlyCents);
  return {
    currency: 'CNY',
    monthly_recurring: yuan(monthly),
    yearly_recurring: yuan(monthly * 12),
    budget_monthly: prefs.budgetCents ? yuan(prefs.budgetCents) : null,
    paid_this_year: yuan(pays.filter((p) => p.date.startsWith(t.slice(0, 4)) && p.date <= t).reduce((x, p) => x + p.amountCents, 0)),
    still_due_this_month: yuan(dueThisMonth),
    last_12_months: months,
    monthly_by_category: [...byCat.entries()].sort((x, y) => y[1] - x[1]).map(([category, c]) => ({ category, monthly: yuan(c) })),
  };
}

const ro = (t: Omit<Tool, 'write'>): Tool => ({ ...t, write: false });
const rw = (t: Omit<Tool, 'write'>): Tool => ({ ...t, write: true });

export const TOOLS: Tool[] = [
  ro({
    name: 'get_overview',
    title: '总览',
    description: '一次看清整体情况：订阅数量、每月/每年固定支出、预算、待办数量、30 天内扣费、安全风险数。适合作为第一步调用。',
    inputSchema: obj({}),
    run: () => {
      const t = today();
      const subs = listSubs();
      const sp = spending();
      const end = addDays(t, 30);
      const upcoming = subs.filter((s) => s.kind === 'sub' && s.status === 'active' && (s.trialEnd ?? s.nextDate ?? '') >= t && (s.trialEnd ?? s.nextDate ?? '') <= end);
      const count = (g: string) => subs.filter((s) => s.state.group === g).length;
      return {
        today: t,
        subscriptions: { total: subs.length, active: count('active'), trial: count('trial'), ended: count('ended'), once: count('once'), free_only: count('free') },
        emails: listEmails().length,
        pay_methods: listPayMethods().length,
        monthly_recurring: sp.monthly_recurring,
        yearly_recurring: sp.yearly_recurring,
        budget_monthly: sp.budget_monthly,
        paid_this_year: sp.paid_this_year,
        todos: todos().count,
        charges_next_30_days: { count: upcoming.length, total: yuan(upcoming.reduce((x, s) => x + s.priceCents, 0)) },
        security_risks: securityRisks().filter((r) => r.level !== 'low').length,
      };
    },
  }),
  ro({
    name: 'list_subscriptions',
    title: '订阅列表',
    description: '查询订阅（含付费订阅、试用、买断和只注册未付费的服务）。可按关键字、状态分组、邮箱、渠道、分类筛选。金额单位为人民币元。',
    inputSchema: obj({
      query: { type: 'string', description: '关键字，匹配服务名、档位、邮箱、渠道、支付方式、备注' },
      group: { type: 'string', enum: Object.keys(GROUPS), default: 'all', description: 'attention=需处理（快到期/已过期/试用快结束），active=使用中，trial=试用中，ended=已取消或过期，once=买断，free=仅注册' },
      email: { type: 'string', description: '邮箱地址或 ID' },
      channel: { type: 'string' },
      category: { type: 'string', enum: CATEGORIES },
      limit: P.limit(50, 200),
      offset: P.offset,
    }),
    run: (a) => {
      const q = (text(a, 'query') ?? '').trim().toLowerCase();
      const group = GROUPS[text(a, 'group') ?? 'all'] ?? GROUPS.all;
      const emailArg = text(a, 'email');
      const email = emailArg ? findEmail(emailArg) : null;
      if (emailArg && !email) throw new ToolError(`邮箱 ${emailArg} 不存在`);
      const channel = text(a, 'channel');
      const category = text(a, 'category');
      const rows = listSubs()
        .filter((s) => group(s) && (!email || s.emailId === email.id) && (!channel || s.channel === channel) && (!category || s.category === category))
        .filter((s) => !q || [s.name, s.plan, s.emailAddress, s.channel, s.payName, s.note, s.category].join(' ').toLowerCase().includes(q))
        .sort((x, y) => (x.trialEnd ?? x.nextDate ?? '9999').localeCompare(y.trialEnd ?? y.nextDate ?? '9999'));
      return page(rows.map(subRow), a, 50, 200);
    },
  }),
  ro({
    name: 'get_subscription',
    title: '订阅详情',
    description: '查看一个订阅的完整信息：登录邮箱、付费记录、价格变动、备注卡片，以及按付费渠道给出的取消步骤。',
    inputSchema: obj({ id: P.id }, ['id']),
    run: (a) => {
      const s = findSub(int(a, 'id', { required: true }));
      const e = db.select().from(schema.emails).where(eq(schema.emails.id, s.emailId)).get()!;
      return {
        ...subRow(s),
        note: s.note,
        url: s.url,
        login: LOGINS[s.login] ?? s.login,
        mfa: MFAS[s.mfa] ?? s.mfa,
        usage_label: USAGES[s.usage] ?? '',
        snoozed_until: s.snoozeUntil,
        reviewed_at: s.reviewedAt,
        cycle_label: s.kind === 'sub' ? CYCLE_LABEL[s.cycle] : null,
        email_account: { id: e.id, address: e.address, provider: e.provider, phone: maskPhone(e.phone), recovery: e.recovery },
        payments: paymentsOf(s.id).slice(0, 50).map((p) => ({ id: p.id, date: p.date, amount: yuan(p.amountCents), auto: p.auto, note: p.note })),
        price_changes: priceChangesOf(s.id).map((c) => ({ date: c.date, old: yuan(c.oldCents), new: yuan(c.newCents) })),
        notes: notesOf('sub', s.id).map((n) => ({ id: n.id, title: n.title, body: n.body, pinned: n.pinned })),
        cancel_guide: s.kind === 'sub' ? (GUIDES[s.channel] ?? GUIDES['官网 · 信用卡']) : [],
      };
    },
  }),
  ro({
    name: 'list_todos',
    title: '待办',
    description: '现在需要处理的事：快到期或已过期的订阅、试用快结束、支付卡快过期、超出预算、该做订阅体检了。每项给出可用的后续工具。',
    inputSchema: obj({}),
    run: todos,
  }),
  ro({
    name: 'upcoming_charges',
    title: '即将扣费',
    description: '未来若干天内预计的每一笔扣费（按自动续费周期推算），以及合计金额。',
    inputSchema: obj({ days: { type: 'integer', minimum: 1, maximum: 366, default: 30, description: '往后看多少天，默认 30' } }),
    run: (a) => {
      const t = today();
      const end = addDays(t, int(a, 'days', { def: 30, min: 1, max: 366 }));
      const items = listSubs()
        .flatMap((s) => projectedDates(s, t, end, t).map((date) => ({ date, subscription_id: s.id, name: `${s.name} ${s.plan}`.trim(), amount: yuan(s.priceCents), is_trial_end: date === s.trialEnd, auto_renew: s.autoRenew, channel: s.channel, pay_method: s.payName, email: s.emailAddress })))
        .sort((x, y) => x.date.localeCompare(y.date));
      return { from: t, to: end, count: items.length, total: yuan(items.reduce((x, i) => x + Math.round(i.amount * 100), 0)), items };
    },
  }),
  ro({
    name: 'list_emails',
    title: '邮箱账号',
    description: '列出所有邮箱账号，含绑定手机（默认打码）、辅助邮箱、注册的服务数和每月支出。',
    inputSchema: obj({ query: { type: 'string' }, reveal_phone: { type: 'boolean', default: false, description: '是否显示完整手机号' } }),
    run: (a) => {
      const q = (text(a, 'query') ?? '').toLowerCase();
      const reveal = bool(a, 'reveal_phone');
      const subs = listSubs();
      return listEmails()
        .filter((e) => !q || [e.address, e.note, e.recovery].join(' ').toLowerCase().includes(q))
        .map((e) => {
          const mine = subs.filter((s) => s.emailId === e.id);
          return { id: e.id, address: e.address, provider: e.provider, phone: reveal ? e.phone : maskPhone(e.phone), recovery: e.recovery, note: e.note, services: mine.map((s) => `${s.name} ${s.plan}`.trim()), monthly_cost: yuan(mine.reduce((x, s) => x + s.monthlyCents, 0)) };
        });
    },
  }),
  ro({
    name: 'list_pay_methods',
    title: '支付方式',
    description: '列出支付方式（银行卡、Apple ID、PayPal 等），含有效期、是否快过期、绑定了哪些订阅。',
    inputSchema: obj({}),
    run: () => {
      const subs = listSubs();
      const expiring = new Set(expiringPayMethods().map((p) => p.id));
      return listPayMethods().map((p) => ({ id: p.id, name: p.name, type: p.type, expire_month: p.expireMonth, expiring_soon: expiring.has(p.id), note: p.note, subscriptions: subs.filter((s) => s.payMethodId === p.id).map((s) => ({ id: s.id, name: `${s.name} ${s.plan}`.trim(), status: s.status })) }));
    },
  }),
  ro({
    name: 'list_notes',
    title: '备注卡片',
    description: '查询备注卡片（记录在邮箱或订阅上的取消方法、发票、共享成员等信息）。',
    inputSchema: obj({ query: { type: 'string' }, target_type: { type: 'string', enum: ['email', 'sub'] }, target_id: { type: 'integer' }, limit: P.limit(50, 200), offset: P.offset }),
    run: (a) => {
      const q = (text(a, 'query') ?? '').toLowerCase();
      const tt = text(a, 'target_type');
      const tid = int(a, 'target_id');
      const subs = new Map(listSubs().map((s) => [s.id, `${s.name} ${s.plan}`.trim()]));
      const mails = new Map(listEmails().map((e) => [e.id, e.address]));
      const rows = listNotes()
        .filter((n) => (!tt || n.targetType === tt) && (!tid || n.targetId === tid) && (!q || `${n.title} ${n.body}`.toLowerCase().includes(q)))
        .map((n) => ({ id: n.id, target_type: n.targetType, target_id: n.targetId, target: (n.targetType === 'sub' ? subs : mails).get(n.targetId) ?? '', title: n.title, body: n.body, color: n.color, pinned: n.pinned, updated_at: n.updatedAt }));
      return page(rows, a, 50, 200);
    },
  }),
  ro({
    name: 'list_payments',
    title: '付费记录',
    description: '历史付费记录（含自动续费补记的），可按年份或订阅筛选，按日期倒序。',
    inputSchema: obj({ year: { type: 'integer', description: '如 2026' }, subscription_id: { type: 'integer' }, limit: P.limit(50, 500), offset: P.offset }),
    run: (a) => {
      const y = int(a, 'year');
      const sid = int(a, 'subscription_id');
      const rows = listPayments().filter((p) => (!y || p.date.startsWith(`${y}-`)) && (!sid || p.subscriptionId === sid));
      const r = page(rows.map((p) => ({ id: p.id, date: p.date, subscription_id: p.subscriptionId, name: `${p.name} ${p.plan}`.trim(), amount: yuan(p.amountCents), auto: p.auto, channel: p.channel, pay_method: p.payName, email: p.emailAddress, note: p.note })), a, 50, 500);
      return { ...r, sum_all_matched: yuan(rows.reduce((x, p) => x + p.amountCents, 0)) };
    },
  }),
  ro({
    name: 'get_spending',
    title: '支出分析',
    description: '支出统计：每月/每年固定支出、今年已付、本月还要扣多少、近 12 个月每月实付、按分类的月支出。',
    inputSchema: obj({}),
    run: spending,
  }),
  ro({
    name: 'get_review',
    title: '订阅体检',
    description: '找出可以省钱的地方：花得多用得少、同类重复订阅、同一服务多处付费、近期涨价、资料缺失，以及一年可省多少。',
    inputSchema: obj({}),
    run: () => {
      const r = buildReview(listSubs());
      const brief = (s: SubView) => ({ id: s.id, name: `${s.name} ${s.plan}`.trim(), email: s.emailAddress, monthly_cost: yuan(s.monthlyCents), usage: USAGES[s.usage] ?? '' });
      return {
        yearly_saving_if_cancel_low_usage: yuan(r.yearlySavingCents),
        low_usage: r.waste.map(brief),
        usage_unmarked: r.unmarked.map(brief),
        same_category: r.overlaps.map((o) => ({ category: o.category, monthly_cost: yuan(o.monthlyCents), subscriptions: o.subs.map(brief) })),
        duplicates: r.duplicates.map((d) => ({ name: d.name, subscriptions: d.subs.map(brief) })),
        price_increases: r.increases.map((s) => ({ ...brief(s), change: s.lastChange && { date: s.lastChange.date, old: yuan(s.lastChange.oldCents), new: yuan(s.lastChange.newCents) } })),
        missing_info: { manage_url: r.missing.manage, pay_method: r.missing.pay, channel: r.missing.channel },
        last_review: getSetting('last_review'),
      };
    },
  }),
  ro({
    name: 'get_security_risks',
    title: '账号安全',
    description: '账号安全检查结果：辅助邮箱缺失、邮箱互为辅助、共用手机号、依赖第三方一键登录、未开两步验证等。',
    inputSchema: obj({}),
    run: () => securityRisks().map((r) => ({ level: r.level, title: r.title, detail: r.detail })),
  }),
  ro({
    name: 'list_activity',
    title: '操作日志',
    description: '最近的操作记录（新建、编辑、续费、删除、登录等），按时间倒序，时间为 UTC。',
    inputSchema: obj({ limit: P.limit(30, 200) }),
    run: (a) => db.select().from(schema.activity).orderBy(desc(schema.activity.id)).limit(int(a, 'limit', { def: 30, min: 1, max: 200 })).all().map((x) => ({ at: x.at, action: x.action, target: x.target, detail: x.detail })),
  }),

  /* ---------- 写操作 ---------- */
  rw({
    name: 'save_subscription',
    title: '新建或修改订阅',
    description: '不传 id 时新建（需要 name、email；付费的还要 price 和 date）。传 id 时修改，只需传要改的字段，其余保持不变。修改金额会自动记录价格变动。新建买断（kind=once）会自动记一笔付费。',
    inputSchema: obj({ id: { type: 'integer', description: '要修改的订阅 ID；新建时不传' }, ...SUB_FIELDS }),
    run: saveSub,
  }),
  rw({
    name: 'renew_subscription',
    title: '标记已续费',
    description: '手动续费后调用：按今天记一笔付费，下次扣费日顺延一个周期。开启自动续费的订阅到期后系统会自动顺延，一般不用手动调用。',
    inputSchema: obj({ id: P.id }, ['id']),
    run: async (a) => {
      const r = check(await ops.markRenewed(int(a, 'id', { required: true })));
      return { ok: true, next_date: r.nextDate };
    },
  }),
  rw({
    name: 'cancel_subscription',
    title: '标记已取消',
    description: '用户已经在服务方取消订阅后调用：关闭自动续费，保留到期日，之后不再提醒。不会删除记录。',
    inputSchema: obj({ id: P.id }, ['id']),
    run: async (a) => check(await ops.cancelSubscription(int(a, 'id', { required: true }))),
  }),
  rw({
    name: 'convert_trial',
    title: '试用转正式',
    description: '试用结束后继续付费：试用结束日成为首次扣费日，并开启自动续费。',
    inputSchema: obj({ id: P.id }, ['id']),
    run: async (a) => check(await ops.convertTrial(int(a, 'id', { required: true }))),
  }),
  rw({
    name: 'snooze_subscription',
    title: '稍后提醒',
    description: '暂时不提醒这个订阅，若干天后再提醒。',
    inputSchema: obj({ id: P.id, days: { type: 'integer', minimum: 1, maximum: 30, default: 3 } }, ['id']),
    run: async (a) => check(await ops.snoozeSubscription(int(a, 'id', { required: true }), int(a, 'days', { def: 3 }))),
  }),
  rw({
    name: 'set_usage',
    title: '标记使用频率',
    description: '记录这个订阅用得多不多，订阅体检据此找出浪费。',
    inputSchema: obj({ id: P.id, usage: SUB_FIELDS.usage }, ['id', 'usage']),
    run: async (a) => check(await ops.setUsage(int(a, 'id', { required: true }), text(a, 'usage') ?? '')),
  }),
  rw({
    name: 'add_payment',
    title: '补记付费',
    description: '给订阅补记一笔历史付费。',
    inputSchema: obj({ id: P.id, date: P.date('付费日期'), amount: { type: 'number', exclusiveMinimum: 0, description: '金额，人民币元' } }, ['id', 'date', 'amount']),
    run: async (a) => {
      const date = text(a, 'date') ?? '';
      if (!isValidDate(date)) throw new ToolError('日期格式应为 YYYY-MM-DD');
      return check(await ops.addPayment(int(a, 'id', { required: true }), date, String(a.amount ?? '')));
    },
  }),
  rw({
    name: 'delete_subscription',
    title: '删除订阅',
    description: '把订阅移入回收站（连同它的备注卡片），30 天内可在网页「回收站」恢复。只是不再用了请用 cancel_subscription。',
    destructive: true,
    inputSchema: obj({ id: P.id }, ['id']),
    run: async (a) => check(await ops.deleteSubscription(int(a, 'id', { required: true }))),
  }),
  rw({
    name: 'save_email',
    title: '添加或修改邮箱',
    description: '不传 id 时添加邮箱；传 id 时修改，只需传要改的字段。',
    inputSchema: obj({ id: { type: 'integer' }, address: { type: 'string' }, phone: { type: 'string', description: '绑定的手机号' }, recovery: { type: 'string', description: '辅助邮箱' }, note: { type: 'string' } }),
    run: async (a) => {
      const id = int(a, 'id');
      const old = id ? listEmails().find((e) => e.id === id) : null;
      if (id && !old) throw new ToolError(`邮箱 ${id} 不存在`);
      const r = check(await ops.saveEmail({ id: old?.id, address: text(a, 'address') ?? old?.address ?? '', phone: text(a, 'phone') ?? old?.phone ?? '', recovery: text(a, 'recovery') ?? old?.recovery ?? '', note: text(a, 'note') ?? old?.note ?? '' }));
      return { ok: true, id: r.id };
    },
  }),
  rw({
    name: 'save_pay_method',
    title: '添加或修改支付方式',
    description: '不传 id 时添加；传 id 时修改，只需传要改的字段。不要填写完整卡号，用「招行信用卡 尾号 1234」这样的名称。',
    inputSchema: obj({ id: { type: 'integer' }, name: { type: 'string' }, type: { type: 'string', description: '信用卡、借记卡、Apple ID、Google Play、PayPal、支付宝、微信支付、其他' }, expire_month: { type: 'string', pattern: '^(\\d{4}-\\d{2})?$', description: '有效期 YYYY-MM' }, note: { type: 'string' } }),
    run: async (a) => {
      const id = int(a, 'id');
      const old = id ? listPayMethods().find((p) => p.id === id) : null;
      if (id && !old) throw new ToolError(`支付方式 ${id} 不存在`);
      const r = check(await ops.savePayMethod({ id: old?.id, name: text(a, 'name') ?? old?.name ?? '', type: text(a, 'type') ?? old?.type ?? '其他', expireMonth: text(a, 'expire_month') ?? old?.expireMonth ?? '', note: text(a, 'note') ?? old?.note ?? '' }));
      return { ok: true, id: r.id };
    },
  }),
  rw({
    name: 'save_note',
    title: '新建或修改备注卡片',
    description: '在邮箱或订阅上记一张备注卡片。不传 id 时新建（需要 target_type、target_id、title）；传 id 时修改，只需传要改的字段。不要记录密码。',
    inputSchema: obj({
      id: { type: 'integer' },
      target_type: { type: 'string', enum: ['email', 'sub'] },
      target_id: { type: 'integer', description: '邮箱 ID 或订阅 ID' },
      title: { type: 'string' },
      body: { type: 'string' },
      color: { type: 'string', enum: NOTE_COLORS.map(([c]) => c) },
      pinned: { type: 'boolean' },
    }),
    run: async (a) => {
      const id = int(a, 'id');
      const old = id ? db.select().from(schema.notes).where(and(eq(schema.notes.id, id), isNull(schema.notes.deletedAt))).get() : null;
      if (id && !old) throw new ToolError(`卡片 ${id} 不存在`);
      const r = check(
        await ops.saveNote({
          id: old?.id,
          targetType: (text(a, 'target_type') ?? old?.targetType ?? 'sub') as 'email' | 'sub',
          targetId: int(a, 'target_id', { def: old?.targetId ?? 0 }),
          title: text(a, 'title') ?? old?.title ?? '',
          body: text(a, 'body') ?? old?.body ?? '',
          color: text(a, 'color') ?? old?.color ?? 'yellow',
          pinned: bool(a, 'pinned') ?? old?.pinned ?? false,
        }),
      );
      return { ok: true, id: r.id };
    },
  }),
];
