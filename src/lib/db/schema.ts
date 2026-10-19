import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
};

/** 邮箱账号：整个系统的根 */
export const emails = sqliteTable('emails', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  address: text('address').notNull(),
  provider: text('provider').notNull().default('其他'),
  phone: text('phone').notNull().default(''),
  recovery: text('recovery').notNull().default(''),
  note: text('note').notNull().default(''),
  deletedAt: text('deleted_at'),
  ...timestamps,
});

/** 支付方式：信用卡、Apple ID、PayPal、支付宝… */
export const payMethods = sqliteTable('pay_methods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull().default('信用卡'),
  /** 有效期，格式 YYYY-MM；为空表示长期有效 */
  expireMonth: text('expire_month'),
  note: text('note').notNull().default(''),
  deletedAt: text('deleted_at'),
  ...timestamps,
});

/** 订阅 / 服务。金额一律以「分」存储 */
export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    plan: text('plan').notNull().default(''),
    category: text('category').notNull().default('其他'),
    emailId: integer('email_id')
      .notNull()
      .references(() => emails.id, { onDelete: 'restrict' }),
    /** sub 订阅 / once 一次性买断 / free 免费仅注册 */
    kind: text('kind', { enum: ['sub', 'once', 'free'] }).notNull().default('sub'),
    priceCents: integer('price_cents').notNull().default(0),
    cycle: text('cycle', { enum: ['week', 'month', 'quarter', 'year'] }).notNull().default('month'),
    /** 月付等周期的锚定日（1-31），用于月末顺延规则 */
    anchorDay: integer('anchor_day'),
    /** 下次扣费日 / 购买日，YYYY-MM-DD */
    nextDate: text('next_date'),
    /** 免费试用结束日，YYYY-MM-DD；非空表示试用中 */
    trialEnd: text('trial_end'),
    autoRenew: integer('auto_renew', { mode: 'boolean' }).notNull().default(true),
    status: text('status', { enum: ['active', 'cancelled', 'expired'] }).notNull().default('active'),
    channel: text('channel').notNull().default(''),
    payMethodId: integer('pay_method_id').references(() => payMethods.id, { onDelete: 'set null' }),
    url: text('url').notNull().default(''),
    manageUrl: text('manage_url').notNull().default(''),
    login: text('login').notNull().default('password'),
    mfa: text('mfa').notNull().default('none'),
    note: text('note').notNull().default(''),
    /** 稍后提醒：在该日期之前不出现在待办里 */
    snoozeUntil: text('snooze_until'),
    /** 使用频率：daily / weekly / monthly / rarely，空表示未标记 */
    usage: text('usage').notNull().default(''),
    /** 上次体检时确认「保留」的时间 */
    reviewedAt: text('reviewed_at'),
    deletedAt: text('deleted_at'),
    ...timestamps,
  },
  (t) => [index('subs_email_idx').on(t.emailId), index('subs_next_idx').on(t.nextDate)],
);

/** 付费记录 */
export const payments = sqliteTable(
  'payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    subscriptionId: integer('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    amountCents: integer('amount_cents').notNull(),
    /** 是否由自动续费顺延生成 */
    auto: integer('auto', { mode: 'boolean' }).notNull().default(false),
    note: text('note').notNull().default(''),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => [index('payments_sub_idx').on(t.subscriptionId), index('payments_date_idx').on(t.date)],
);

/** 备注卡片，关联到邮箱或服务 */
export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  targetType: text('target_type', { enum: ['email', 'sub'] }).notNull(),
  targetId: integer('target_id').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  color: text('color').notNull().default('yellow'),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  deletedAt: text('deleted_at'),
  ...timestamps,
});

/** 价格变动记录 */
export const priceChanges = sqliteTable(
  'price_changes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    subscriptionId: integer('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    oldCents: integer('old_cents').notNull(),
    newCents: integer('new_cents').notNull(),
  },
  (t) => [index('price_changes_sub_idx').on(t.subscriptionId)],
);

/** 操作日志 */
export const activity = sqliteTable(
  'activity',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: text('at').notNull().default(sql`(datetime('now'))`),
    action: text('action').notNull(),
    target: text('target').notNull().default(''),
    detail: text('detail').notNull().default(''),
  },
  (t) => [index('activity_at_idx').on(t.at)],
);

/** AI / 命令行接入用的 API 令牌，只保存 SHA-256 哈希 */
export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    hash: text('hash').notNull(),
    /** 令牌开头几位，方便辨认 */
    prefix: text('prefix').notNull(),
    scope: text('scope', { enum: ['read', 'write'] }).notNull().default('read'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    lastUsedAt: text('last_used_at'),
  },
  (t) => [uniqueIndex('api_tokens_hash_idx').on(t.hash)],
);

/** 键值设置：密码哈希、两步验证密钥、提醒天数、皮肤等 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Email = typeof emails.$inferSelect;
export type PayMethod = typeof payMethods.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type PriceChange = typeof priceChanges.$inferSelect;
export type Activity = typeof activity.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
