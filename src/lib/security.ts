import 'server-only';
import { maskPhone } from './constants';
import { expiringPayMethods, listEmails, listPayMethods, listSubs, type SubView } from './queries';

export type RiskLevel = 'high' | 'mid' | 'low';
export interface Risk {
  level: RiskLevel;
  title: string;
  detail: string;
  /** 处理入口 */
  href?: string;
}

/** 账号安全检查：辅助邮箱、手机号、支付方式、一键登录依赖、两步验证 */
export function securityRisks(emails = listEmails(), subs: SubView[] = listSubs(), payList = listPayMethods()): Risk[] {
  const r: Risk[] = [];
  for (const e of emails) {
    if (!e.recovery) r.push({ level: 'high', title: `${e.address} 没有设置辅助邮箱`, detail: '忘记密码或被盗时可能无法找回。建议绑定一个其他服务商的邮箱作为辅助邮箱。', href: `/emails?edit=${e.id}` });
  }
  for (const a of emails) {
    const b = emails.find((x) => x.address === a.recovery);
    if (b && b.recovery === a.address && a.id < b.id) {
      r.push({ level: 'mid', title: `${a.address} 和 ${b.address} 互为辅助邮箱`, detail: '两个邮箱同时出问题时都无法找回。建议其中一个改用第三个邮箱或手机号找回。', href: `/emails?edit=${a.id}` });
    }
  }
  const byPhone = new Map<string, string[]>();
  for (const e of emails) if (e.phone) byPhone.set(e.phone, [...(byPhone.get(e.phone) ?? []), e.address]);
  for (const [phone, list] of byPhone) {
    if (list.length > 1) r.push({ level: 'mid', title: `${list.length} 个邮箱绑定了同一个手机号 ${maskPhone(phone)}`, detail: `${list.join('、')}。这个号码停用或丢失后，这些邮箱都无法用短信找回。` });
  }
  for (const p of expiringPayMethods(payList)) {
    const n = subs.filter((s) => s.payMethodId === p.id && s.kind !== 'free').length;
    r.push({ level: 'mid', title: `${p.name} 将于 ${p.expireMonth} 到期`, detail: `绑定了 ${n} 个订阅，换卡后需要逐个更新付款方式。`, href: `/subscriptions?pay=${p.id}` });
  }
  for (const e of emails) {
    const g = subs.filter((s) => s.emailId === e.id && (s.login === 'google' || s.login === 'apple') && s.status === 'active');
    if (g.length >= 3) {
      r.push({ level: 'low', title: `${g.length} 个服务用 ${e.address} 一键登录`, detail: `这个邮箱一旦丢失，${g.slice(0, 5).map((s) => s.name).join('、')} 等服务都登录不了。请确保它的辅助邮箱和两步验证可用。` });
    }
  }
  const noMfa = subs.filter((s) => s.kind !== 'free' && s.status === 'active' && s.mfa === 'none');
  if (noMfa.length) {
    r.push({ level: 'low', title: `${noMfa.length} 个付费服务没有开启两步验证`, detail: `${noMfa.slice(0, 6).map((s) => s.name).join('、')}${noMfa.length > 6 ? ' 等' : ''}。付费账号被盗会直接产生损失，建议开启。`, href: '/subscriptions?mfa=none' });
  }
  const order: Record<RiskLevel, number> = { high: 0, mid: 1, low: 2 };
  return r.sort((a, b) => order[a.level] - order[b.level]);
}
