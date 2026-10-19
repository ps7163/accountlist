CREATE TABLE `emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`address` text NOT NULL,
	`provider` text DEFAULT '其他' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`recovery` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emails_address_unique` ON `emails` (`address`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'yellow' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pay_methods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT '信用卡' NOT NULL,
	`expire_month` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`auto` integer DEFAULT false NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payments_sub_idx` ON `payments` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `payments_date_idx` ON `payments` (`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`plan` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '其他' NOT NULL,
	`email_id` integer NOT NULL,
	`kind` text DEFAULT 'sub' NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`cycle` text DEFAULT 'month' NOT NULL,
	`anchor_day` integer,
	`next_date` text,
	`trial_end` text,
	`auto_renew` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`channel` text DEFAULT '' NOT NULL,
	`pay_method_id` integer,
	`url` text DEFAULT '' NOT NULL,
	`manage_url` text DEFAULT '' NOT NULL,
	`login` text DEFAULT 'password' NOT NULL,
	`mfa` text DEFAULT 'none' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`snooze_until` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`pay_method_id`) REFERENCES `pay_methods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `subs_email_idx` ON `subscriptions` (`email_id`);--> statement-breakpoint
CREATE INDEX `subs_next_idx` ON `subscriptions` (`next_date`);