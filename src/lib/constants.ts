/* 共享常量：前后端通用 */

export const CHANNELS = ['Apple App Store', 'Google Play', '官网 · 信用卡', 'PayPal', '支付宝', '微信支付', '其他'];
export const CATEGORIES = ['AI', '开发工具', '影音', '存储', '工具', '设计', '学习', '其他'];
export const PAY_TYPES = ['信用卡', '借记卡', 'Apple ID', 'Google Play', 'PayPal', '支付宝', '微信支付', '其他'];
export const LOGINS: Record<string, string> = { password: '邮箱 + 密码', google: 'Google 一键登录', apple: 'Apple 登录', phone: '手机号验证码', code: '邮箱验证码' };
export const MFAS: Record<string, string> = { app: '验证器 App', sms: '短信验证码', none: '未开启' };
/** 使用频率；空字符串表示未标记 */
export const USAGES: Record<string, string> = { '': '未标记', daily: '每天用', weekly: '每周用', monthly: '每月偶尔用', rarely: '几乎不用' };
export const NOTE_COLORS: [string, string][] = [['yellow', '便签黄'], ['blue', '天空蓝'], ['green', '薄荷绿'], ['pink', '樱花粉'], ['purple', '薰衣草'], ['gray', '素白']];

export function providerOf(address: string): string {
  const dom = (address.split('@')[1] || '').toLowerCase();
  const map: Record<string, string> = { 'gmail.com': 'Gmail', 'googlemail.com': 'Gmail', 'outlook.com': 'Outlook', 'hotmail.com': 'Outlook', 'live.com': 'Outlook', 'icloud.com': 'iCloud', 'me.com': 'iCloud', 'qq.com': 'QQ 邮箱', 'foxmail.com': 'QQ 邮箱', '163.com': '网易邮箱', '126.com': '网易邮箱', 'yahoo.com': 'Yahoo', 'proton.me': 'Proton', 'protonmail.com': 'Proton' };
  return map[dom] || '其他';
}

/** 按付费渠道生成的取消步骤 */
export const GUIDES: Record<string, string[]> = {
  'Apple App Store':['打开 iPhone「设置」', '点最上方的 Apple ID 名字', '进入「订阅」', '选择该服务，点「取消订阅」'],
  'Google Play':['打开 Google Play 商店', '点右上角头像 →「付款和订阅」', '进入「订阅」，选择该服务', '点「取消订阅」'],
  'PayPal':['登录 PayPal 网页版', '设置 →「付款」→「管理自动付款」', '找到该服务，点「取消」'],
  '官网 · 信用卡':['登录服务官网', '进入账户设置里的「账单 / Billing / 订阅」', '点「取消订阅」或关闭自动续费'],
  '支付宝':['打开支付宝 →「我的」→ 右上角「设置」', '「支付设置」→「免密支付/自动扣款」', '找到该服务，点「关闭服务」'],
  '微信支付':['打开微信 →「我」→「服务」', '右上角「…」→「支付设置」→「自动续费」', '找到该服务，关闭自动续费'],
  '其他':['登录服务官网，在账户或账单设置中取消'],
};

export interface ServiceTemplate { name: string; plan: string; cat: string; price: number; cycle: 'week' | 'month' | 'quarter' | 'year'; url: string; manage: string }

/** 常用服务模板：新建订阅时自动填写 */
export const TEMPLATES: ServiceTemplate[] = ([
  ['Claude','Pro','AI',148,'month','https://claude.ai','https://claude.ai/settings/billing'], ['ChatGPT','Plus','AI',145,'month','https://chatgpt.com','https://chatgpt.com'],
  ['Gemini','Advanced','AI',145,'month','https://gemini.google.com','https://one.google.com'], ['Perplexity','Pro','AI',145,'month','https://www.perplexity.ai','https://www.perplexity.ai/settings'],
  ['Midjourney','Basic','AI',72,'month','https://www.midjourney.com','https://www.midjourney.com/account'], ['Cursor','Pro','开发工具',1380,'year','https://cursor.com','https://cursor.com/settings'],
  ['GitHub Copilot','Individual','开发工具',72,'month','https://github.com','https://github.com/settings/billing'], ['Netflix','标准','影音',68,'month','https://netflix.com','https://www.netflix.com/account'],
  ['YouTube Premium','个人','影音',98,'month','https://youtube.com','https://www.youtube.com/paid_memberships'], ['Spotify','Premium','影音',85,'month','https://spotify.com','https://www.spotify.com/account'],
  ['Disney+','高级','影音',89,'month','https://www.disneyplus.com','https://www.disneyplus.com/account'], ['iCloud+','200GB','存储',21,'month','https://www.icloud.com','https://apps.apple.com/account/subscriptions'],
  ['Google One','2TB','存储',75,'month','https://one.google.com','https://one.google.com/settings'], ['Microsoft 365','家庭','工具',398,'year','https://www.microsoft.com/microsoft-365','https://account.microsoft.com/services'],
  ['1Password','个人版','工具',258,'year','https://1password.com','https://my.1password.com'], ['Notion','Plus','工具',75,'month','https://notion.so','https://www.notion.so/settings'],
  ['Figma','Professional','设计',108,'month','https://figma.com','https://www.figma.com/settings'], ['Canva','Pro','设计',89,'month','https://www.canva.cn','https://www.canva.cn/settings/billing'],
  ['网易云音乐','黑胶 VIP','影音',158,'year','https://music.163.com',''], ['爱奇艺','黄金 VIP','影音',68,'quarter','https://www.iqiyi.com',''],
  ['腾讯视频','VIP','影音',30,'month','https://v.qq.com',''], ['哔哩哔哩','大会员','影音',148,'year','https://www.bilibili.com',''], ['百度网盘','超级会员','存储',30,'month','https://pan.baidu.com',''],
] as [string, string, string, number, ServiceTemplate['cycle'], string, string][]).map(([name, plan, cat, price, cycle, url, manage]) => ({ name, plan, cat, price, cycle, url, manage }));

export function maskPhone(p: string): string {
  return p.replace(/(\d{3,4})(\s?)(\d{4})$/, (_m, _a, s, b) => '****' + s + b);
}
