import 'server-only';
import crypto from 'node:crypto';
import { addCycle, formatYuan, projectedDates, today, addDays } from './billing';
import { expiringPayMethods, listPayMethods, listSubs } from './queries';
import { securityRisks } from './security';
import { getPrefs, getSetting, setSetting } from './settings';

/* ---------------- 日历订阅（ICS） ---------------- */

export function calendarToken(reset = false): string {
  let t = getSetting('ics_token');
  if (!t || reset) {
    t = crypto.randomBytes(18).toString('base64url');
    setSetting('ics_token', t);
  }
  return t;
}

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const icsDate = (d: string) => d.replace(/-/g, '');

/** 未来 12 个月的扣费日和试用结束日，每个事件提前 1 天和提醒天数各提醒一次 */
export function buildIcs(): string {
  const t = today();
  const end = addCycle(t, 'year', 1);
  const { remindDays } = getPrefs();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//accountlist//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:账号簿 · 扣费提醒', 'X-WR-TIMEZONE:Asia/Shanghai', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H'];
  for (const s of listSubs()) {
    for (const d of projectedDates(s, t, end, t)) {
      const trial = s.trialEnd === d;
      const summary = trial ? `${s.name} ${s.plan} 试用结束，开始扣费 ${formatYuan(s.priceCents)}` : `${s.name} ${s.plan} 扣费 ${formatYuan(s.priceCents)}`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:sub-${s.id}-${d}@accountlist`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(d)}`,
        `DTEND;VALUE=DATE:${icsDate(addDays(d, 1))}`,
        `SUMMARY:${icsEscape(summary.replace(/\s+/g, ' ').trim())}`,
        `DESCRIPTION:${icsEscape(`登录邮箱：${s.emailAddress}\n付费渠道：${s.channel || '—'}\n支付方式：${s.payName || '—'}${s.manageUrl ? `\n管理订阅：${s.manageUrl}` : ''}`)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(summary)}`, 'TRIGGER:-P1D', 'END:VALARM',
        ...(remindDays > 1 ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(summary)}`, `TRIGGER:-P${remindDays}D`, 'END:VALARM'] : []),
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  // 按 RFC 5545 折行（75 字节）
  return lines.map((l) => fold(l)).join('\r\n') + '\r\n';
}

function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = '';
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

/* ---------------- 飞书机器人 ---------------- */

export interface FeishuConfig {
  enabled: boolean;
  webhook: string;
  secret: string;
  time: string;
  workdaysOnly: boolean;
  appUrl: string;
  kinds: { due: boolean; trial: boolean; pay: boolean; security: boolean };
}

export function getFeishu(): FeishuConfig {
  const raw = getSetting('feishu');
  const def: FeishuConfig = { enabled: false, webhook: '', secret: '', time: '09:00', workdaysOnly: false, appUrl: '', kinds: { due: true, trial: true, pay: true, security: false } };
  if (!raw) return def;
  try {
    const v = JSON.parse(raw);
    return { ...def, ...v, kinds: { ...def.kinds, ...(v.kinds ?? {}) } };
  } catch {
    return def;
  }
}

export function saveFeishu(c: FeishuConfig): void {
  setSetting('feishu', JSON.stringify(c));
}

/** 生成今日待办文本；没有内容时返回 null */
export function digest(c: FeishuConfig, force = false): string[] | null {
  const subs = listSubs();
  const lines: string[] = [];
  for (const s of subs.filter((x) => x.state.alert).sort((a, b) => (a.state.days ?? 0) - (b.state.days ?? 0))) {
    if (s.trialEnd ? !c.kinds.trial : !c.kinds.due) continue;
    lines.push(s.trialEnd ? `${s.name} ${s.plan} 试用 ${s.trialEnd} 结束，之后 ${formatYuan(s.priceCents)}` : `${s.name} ${s.plan} ${s.state.label}，${s.nextDate} 扣 ${formatYuan(s.priceCents)}（${s.channel || '未填渠道'}）`);
  }
  if (c.kinds.pay) for (const p of expiringPayMethods(listPayMethods())) lines.push(`支付方式「${p.name}」将于 ${p.expireMonth} 到期，记得更新绑定的订阅`);
  if (c.kinds.security && new Date().getDay() === 1) {
    const r = securityRisks().filter((x) => x.level !== 'low');
    if (r.length) lines.push(`账号安全：有 ${r.length} 个需要处理的问题，例如「${r[0].title}」`);
  }
  if (!lines.length && !force) return null;
  return lines.length ? lines : ['今天没有需要处理的订阅。'];
}

export async function sendFeishu(c: FeishuConfig, lines: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!/^https:\/\/open\.(feishu\.cn|larksuite\.com)\/open-apis\/bot\/v2\/hook\//.test(c.webhook)) return { ok: false, error: 'Webhook 地址应以 https://open.feishu.cn/open-apis/bot/v2/hook/ 开头' };
  const content: unknown[][] = lines.map((l) => [{ tag: 'text', text: `· ${l}` }]);
  if (c.appUrl) content.push([{ tag: 'a', text: '打开账号簿', href: c.appUrl }]);
  const body: Record<string, unknown> = { msg_type: 'post', content: { post: { zh_cn: { title: `账号簿 · 今日待办（${today()}）`, content } } } };
  if (c.secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    body.timestamp = String(timestamp);
    body.sign = crypto.createHmac('sha256', `${timestamp}\n${c.secret}`).update('').digest('base64');
  }
  try {
    const res = await fetch(c.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const json = (await res.json().catch(() => ({}))) as { code?: number; msg?: string };
    if (!res.ok || (json.code ?? 0) !== 0) return { ok: false, error: `飞书返回：${json.msg || res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `发送失败：${(e as Error).message}` };
  }
}

/** 定时任务：每分钟检查一次，到了设定时间且今天还没发过就推送 */
export async function feishuTick(now = new Date()): Promise<void> {
  const c = getFeishu();
  if (!c.enabled || !c.webhook) return;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hm = `${get('hour')}:${get('minute')}`;
  if (c.workdaysOnly && ['Sat', 'Sun'].includes(get('weekday'))) return;
  if (hm < c.time || getSetting('feishu_last') === today(now)) return;
  setSetting('feishu_last', today(now));
  const lines = digest(c);
  if (!lines) return;
  const r = await sendFeishu(c, lines);
  if (!r.ok) console.error('[feishu]', r.error);
}
