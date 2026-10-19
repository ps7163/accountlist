import 'server-only';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir, db, rawSqlite, schema } from './db';
import { isValidDate, parseYuan, today, ymd, type Cycle } from './billing';
import { CATEGORIES, LOGINS, MFAS, providerOf } from './constants';
import { listEmails, listPayMethods, listPayments, listSubs } from './queries';
import { getSetting, setSetting } from './settings';

const { emails, payMethods, subscriptions, payments, notes, settings } = schema;
void settings;

/* ---------------- 导出 ---------------- */

const KIND_LABEL = { sub: '订阅', once: '一次性买断', free: '免费' } as const;
const STATUS_LABEL = { active: '使用中', cancelled: '已取消', expired: '已过期' } as const;
const UNIT_LABEL: Record<Cycle, string> = { week: '周', month: '月', quarter: '季', year: '年' };

export const SUB_HEADERS = ['服务名称', '档位', '分类', '登录邮箱', '计费方式', '金额', '周期', '扣费/购买日期', '试用中', '自动续费', '状态', '付费渠道', '支付方式', '服务网址', '管理链接', '登录方式', '两步验证', '备注'];
export const EMAIL_HEADERS = ['邮箱地址', '绑定手机', '辅助邮箱', '备注'];

function subRows() {
  return listSubs().map((s) => [
    s.name, s.plan, s.category, s.emailAddress, KIND_LABEL[s.kind], s.kind === 'free' ? '' : s.priceCents / 100, s.kind === 'sub' ? UNIT_LABEL[s.cycle] : '',
    s.trialEnd ?? s.nextDate ?? '', s.trialEnd ? '是' : '否', s.autoRenew ? '是' : '否', STATUS_LABEL[s.status], s.channel, s.payName, s.url, s.manageUrl,
    LOGINS[s.login] ?? '', MFAS[s.mfa] ?? '', s.note,
  ]);
}

function styleSheet(ws: ExcelJS.Worksheet, widths: number[]) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F3F5' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
}

export async function exportXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '账号簿';
  const s = wb.addWorksheet('订阅');
  s.addRow(SUB_HEADERS);
  subRows().forEach((r) => s.addRow(r));
  styleSheet(s, [18, 12, 10, 26, 10, 10, 6, 14, 8, 8, 8, 16, 22, 28, 28, 14, 12, 30]);
  const e = wb.addWorksheet('邮箱');
  e.addRow(EMAIL_HEADERS);
  listEmails().forEach((x) => e.addRow([x.address, x.phone, x.recovery, x.note]));
  styleSheet(e, [28, 20, 28, 30]);
  const p = wb.addWorksheet('付费记录');
  p.addRow(['日期', '服务', '档位', '登录邮箱', '付费渠道', '支付方式', '金额', '说明']);
  listPayments().forEach((x) => p.addRow([x.date, x.name, x.plan, x.emailAddress, x.channel, x.payName, x.amountCents / 100, x.note]));
  styleSheet(p, [12, 18, 12, 26, 16, 22, 10, 14]);
  const m = wb.addWorksheet('支付方式');
  m.addRow(['名称', '类型', '有效期', '备注']);
  listPayMethods().forEach((x) => m.addRow([x.name, x.type, x.expireMonth ?? '长期有效', x.note]));
  styleSheet(m, [24, 14, 12, 30]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // 防止 CSV 公式注入
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export function exportCsv(): string {
  return '﻿' + [SUB_HEADERS, ...subRows()].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function exportJson(): string {
  return JSON.stringify(
    {
      app: 'accountlist',
      version: 1,
      exportedAt: new Date().toISOString(),
      emails: db.select().from(emails).all(),
      payMethods: db.select().from(payMethods).all(),
      subscriptions: db.select().from(subscriptions).all(),
      payments: db.select().from(payments).all(),
      notes: db.select().from(notes).all(),
      settings: db.select().from(settings).all().filter((s) => ['remind_days', 'skin', 'display_name'].includes(s.key)),
    },
    null,
    2,
  );
}

export async function templateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const help = wb.addWorksheet('填写说明');
  [
    ['账号簿导入模板'],
    [''],
    ['1. 「邮箱」表：每行一个邮箱。也可以不填，订阅表里出现的新邮箱会自动创建。'],
    ['2. 「订阅」表：每行一个服务。带 * 的列必填。'],
    ['3. 计费方式填：订阅 / 一次性买断 / 免费；周期填：周 / 月 / 季 / 年。'],
    ['4. 日期格式：2026-11-05。订阅填下次扣费日，试用中填试用结束日，买断填购买日期。'],
    ['5. 试用中、自动续费填：是 / 否；状态填：使用中 / 已取消 / 已过期。'],
    [`6. 分类可选：${CATEGORIES.join('、')}。`],
    [`7. 登录方式可选：${Object.values(LOGINS).join('、')}；两步验证可选：${Object.values(MFAS).join('、')}。`],
    ['8. 支付方式填名称即可（如「招行信用卡 尾号 1234」），不存在会自动创建。不要填写密码。'],
  ].forEach((r) => help.addRow(r));
  help.getColumn(1).width = 100;
  help.getRow(1).font = { bold: true, size: 14 };
  const e = wb.addWorksheet('邮箱');
  e.addRow(['邮箱地址*', '绑定手机', '辅助邮箱', '备注']);
  e.addRow(['name@gmail.com', '+86 138 0000 0000', 'backup@qq.com', '主力号']);
  styleSheet(e, [28, 20, 28, 30]);
  const s = wb.addWorksheet('订阅');
  s.addRow(SUB_HEADERS.map((h, i) => ([0, 3, 4].includes(i) ? `${h}*` : h)));
  s.addRow(['Claude', 'Pro', 'AI', 'name@gmail.com', '订阅', 148, '月', '2026-11-05', '否', '是', '使用中', 'Apple App Store', 'Apple ID', 'https://claude.ai', '', 'Google 一键登录', '未开启', '']);
  s.addRow(['Notion', 'Free', '工具', 'name@gmail.com', '免费', '', '', '', '', '', '', '', '', 'https://notion.so', '', '邮箱 + 密码', '未开启', '只是注册了账号']);
  styleSheet(s, [18, 12, 10, 26, 10, 10, 6, 14, 8, 8, 8, 16, 22, 28, 28, 14, 12, 30]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------------- 导入 ---------------- */

export interface ImportRow {
  line: number;
  name: string;
  plan: string;
  email: string;
  price: string;
  cycle: string;
  date: string;
  error?: string;
  skip?: string;
}
export interface ImportResult {
  emails: number;
  rows: ImportRow[];
  ok: number;
  bad: number;
  skipped: number;
  imported?: number;
}

type Cell = string;
const cellText = (v: ExcelJS.CellValue): Cell => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return ymd(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === 'object') {
    if ('text' in v && typeof v.text === 'string') return v.text.trim();
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('richText' in v) return v.richText.map((t) => t.text).join('').trim();
    if ('hyperlink' in v) return String(v.hyperlink);
  }
  return String(v).trim();
};

function normDate(s: string): string {
  const m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  return m ? ymd(Number(m[1]), Number(m[2]), Number(m[3])) : s;
}

function parseCsv(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: Cell[] = [], cur = '', q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur.trim()); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cur.trim()); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
  return rows.filter((r) => r.some((x) => x));
}

async function readSheets(buf: Buffer, filename: string): Promise<{ subs: Cell[][]; emails: Cell[][] }> {
  if (/\.csv$/i.test(filename)) return { subs: parseCsv(buf.toString('utf8')), emails: [] };
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const read = (name: string) => {
    const ws = wb.getWorksheet(name);
    if (!ws) return [];
    const out: Cell[][] = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals: Cell[] = [];
      for (let i = 1; i <= Math.max(r.cellCount, 18); i++) vals.push(cellText(r.getCell(i).value));
      out.push(vals);
    });
    return out;
  };
  return { subs: read('订阅'), emails: read('邮箱') };
}

const pick = <T extends string>(map: Record<string, T>, v: string, def: T): T | null => (v === '' ? def : map[v] ?? null);
const KIND_IN: Record<string, 'sub' | 'once' | 'free'> = { 订阅: 'sub', 一次性买断: 'once', 买断: 'once', 一次性: 'once', 免费: 'free', 仅注册: 'free' };
const CYCLE_IN: Record<string, Cycle> = { 周: 'week', 周付: 'week', 月: 'month', 月付: 'month', 季: 'quarter', 季付: 'quarter', 年: 'year', 年付: 'year' };
const STATUS_IN: Record<string, 'active' | 'cancelled' | 'expired'> = { 使用中: 'active', 已取消: 'cancelled', 已过期: 'expired' };
const YES: Record<string, 'y' | 'n'> = { 是: 'y', 否: 'n', y: 'y', n: 'n', yes: 'y', no: 'n', true: 'y', false: 'n', '1': 'y', '0': 'n' };
const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));

/** 解析并校验导入文件；commit 为 true 时写入数据库 */
export async function importFile(buf: Buffer, filename: string, commit: boolean): Promise<ImportResult> {
  const { subs: subRowsIn, emails: emailRowsIn } = await readSheets(buf, filename);
  const existingEmails = new Map(listEmails().map((e) => [e.address, e]));
  const emailRows = emailRowsIn.slice(1).map((r) => ({ address: r[0]?.toLowerCase(), phone: r[1] ?? '', recovery: (r[2] ?? '').toLowerCase(), note: r[3] ?? '' })).filter((r) => r.address);
  const mailOk = (a: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a);
  const loginIn = invert(LOGINS), mfaIn = invert(MFAS);
  const existingSubs = new Set(listSubs().map((s) => `${s.name}|${s.plan}|${s.emailAddress}`.toLowerCase()));

  const rows: (ImportRow & { data?: Record<string, unknown> })[] = [];
  subRowsIn.slice(1).forEach((r, i) => {
    const [name, plan, cat, email, kindS, priceS, cycleS, dateS, trialS, autoS, statusS, channel, payName, url, manage, loginS, mfaS, note] = r.map((x) => x ?? '');
    const row: ImportRow & { data?: Record<string, unknown> } = { line: i + 2, name, plan, email: email.toLowerCase(), price: priceS, cycle: cycleS, date: normDate(dateS) };
    const kind = pick(KIND_IN, kindS, 'sub');
    const cycle = pick(CYCLE_IN, cycleS, 'month');
    const status = pick(STATUS_IN, statusS, 'active');
    const trial = pick(YES, trialS.toLowerCase(), 'n');
    const auto = pick(YES, autoS.toLowerCase(), 'y');
    const errs: string[] = [];
    if (!name) errs.push('缺少服务名称');
    if (!mailOk(row.email)) errs.push('登录邮箱格式不正确');
    if (!kind) errs.push('计费方式应为 订阅/一次性买断/免费');
    if (!cycle) errs.push('周期应为 周/月/季/年');
    if (!status) errs.push('状态不正确');
    if (!trial || !auto) errs.push('试用中/自动续费应填 是/否');
    const priceCents = parseYuan(priceS);
    if (kind && kind !== 'free') {
      if (priceCents <= 0) errs.push('金额不正确');
      if (!isValidDate(row.date)) errs.push('日期无效');
    }
    if (errs.length) row.error = errs.join('；');
    else if (existingSubs.has(`${name}|${plan}|${row.email}`.toLowerCase())) row.skip = '已存在，跳过';
    else {
      existingSubs.add(`${name}|${plan}|${row.email}`.toLowerCase());
      row.data = {
        name: name.slice(0, 100), plan: plan.slice(0, 60), category: CATEGORIES.includes(cat) ? cat : '其他', email: row.email, kind, priceCents: kind === 'free' ? 0 : priceCents, cycle,
        date: kind === 'free' ? null : row.date, trial: kind === 'sub' && trial === 'y', autoRenew: kind === 'sub' && auto === 'y', status: kind === 'sub' ? status : 'active',
        channel: kind === 'free' ? '' : channel.slice(0, 40), payName: kind === 'free' ? '' : payName.slice(0, 80), url: /^https?:\/\//i.test(url) ? url : '', manageUrl: /^https?:\/\//i.test(manage) ? manage : '',
        login: loginIn[loginS] ?? 'password', mfa: mfaIn[mfaS] ?? 'none', note: note.slice(0, 2000),
      };
    }
    rows.push(row);
  });

  const result: ImportResult = {
    emails: emailRows.filter((e) => mailOk(e.address) && !existingEmails.has(e.address)).length,
    rows: rows.map(({ data: _d, ...r }) => r),
    ok: rows.filter((r) => r.data).length,
    bad: rows.filter((r) => r.error).length,
    skipped: rows.filter((r) => r.skip).length,
  };
  if (!commit) return result;

  db.transaction((tx) => {
    const emailId = (address: string, extra?: { phone: string; recovery: string; note: string }) => {
      const ex = existingEmails.get(address);
      if (ex) return ex.id;
      const row = tx.insert(emails).values({ address, provider: providerOf(address), phone: extra?.phone ?? '', recovery: extra?.recovery ?? '', note: extra?.note ?? '' }).returning().get();
      existingEmails.set(address, row);
      return row.id;
    };
    for (const e of emailRows) if (mailOk(e.address)) emailId(e.address, e);
    const payIds = new Map(listPayMethods().map((p) => [p.name, p.id]));
    let imported = 0;
    for (const r of rows) {
      const d = r.data as Record<string, string & number & boolean> | undefined;
      if (!d) continue;
      let payMethodId: number | null = null;
      if (d.payName) {
        payMethodId = payIds.get(d.payName) ?? tx.insert(payMethods).values({ name: d.payName }).returning({ id: payMethods.id }).get().id;
        payIds.set(d.payName, payMethodId);
      }
      const sub = tx.insert(subscriptions).values({
        name: d.name, plan: d.plan, category: d.category, emailId: emailId(d.email), kind: d.kind, priceCents: d.priceCents, cycle: d.cycle,
        anchorDay: d.kind === 'sub' && d.date ? Number(String(d.date).slice(8, 10)) : null, nextDate: d.date || null, trialEnd: d.trial ? d.date : null,
        autoRenew: d.autoRenew, status: d.status, channel: d.channel, payMethodId, url: d.url, manageUrl: d.manageUrl, login: d.login, mfa: d.mfa, note: d.note,
      }).returning({ id: subscriptions.id }).get();
      if (d.kind === 'once') tx.insert(payments).values({ subscriptionId: sub.id, date: d.date, amountCents: d.priceCents, note: '一次性购买' }).run();
      imported++;
    }
    result.imported = imported;
  });
  return result;
}

/* ---------------- 备份与恢复 ---------------- */

const backupDir = () => path.join(dataDir(), 'backups');

/** 每天第一次访问时备份一次数据库，保留最近 30 份 */
export async function dailyBackup(): Promise<void> {
  const t = today();
  if (getSetting('last_backup') === t) return;
  setSetting('last_backup', t);
  fs.mkdirSync(backupDir(), { recursive: true });
  await rawSqlite().backup(path.join(backupDir(), `accountlist-${t}.db`));
  const files = fs.readdirSync(backupDir()).filter((f) => /^accountlist-.*\.db$/.test(f)).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 30))) fs.rmSync(path.join(backupDir(), f));
}

/** 用 JSON 备份覆盖当前数据；覆盖前先备份一次数据库 */
export async function restoreJson(text: string): Promise<{ ok: boolean; error?: string; counts?: Record<string, number> }> {
  let data: Record<string, unknown[]> & { app?: string };
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: '文件不是有效的 JSON' };
  }
  if (data.app !== 'accountlist' || !Array.isArray(data.subscriptions) || !Array.isArray(data.emails)) return { ok: false, error: '这不是账号簿导出的备份文件' };
  fs.mkdirSync(backupDir(), { recursive: true });
  await rawSqlite().backup(path.join(backupDir(), `before-restore-${Date.now()}.db`));
  const counts: Record<string, number> = {};
  try {
    db.transaction((tx) => {
      tx.delete(notes).run();
      tx.delete(payments).run();
      tx.delete(subscriptions).run();
      tx.delete(payMethods).run();
      tx.delete(emails).run();
      const ins = <T>(name: string, table: Parameters<typeof tx.insert>[0], rows: T[] | undefined) => {
        counts[name] = 0;
        for (const r of rows ?? []) { tx.insert(table).values(r as never).run(); counts[name]++; }
      };
      ins('邮箱', emails, data.emails);
      ins('支付方式', payMethods, data.payMethods);
      ins('订阅', subscriptions, data.subscriptions);
      ins('付费记录', payments, data.payments);
      ins('备注卡片', notes, data.notes);
      for (const s of (data.settings ?? []) as { key: string; value: string }[]) if (['remind_days', 'skin', 'display_name'].includes(s.key)) setSetting(s.key, String(s.value));
    });
  } catch (e) {
    return { ok: false, error: `恢复失败，数据未改动：${(e as Error).message}` };
  }
  return { ok: true, counts };
}

export const _test = { parseCsv, normDate, csvCell };
