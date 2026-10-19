import { feishuTick } from './lib/notify';

/** 飞书推送检查：每分钟一次，到点且当天未发送时推送 */
const g = globalThis as unknown as { __alTimer?: NodeJS.Timeout };
if (!g.__alTimer) {
  g.__alTimer = setInterval(() => feishuTick().catch((e) => console.error('[feishu]', e)), 60_000);
}
