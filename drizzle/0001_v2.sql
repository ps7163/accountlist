CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text DEFAULT (datetime('now')) NOT NULL,
	`action` text NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`detail` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_at_idx` ON `activity` (`at`);--> statement-breakpoint
CREATE TABLE `price_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`date` text NOT NULL,
	`old_cents` integer NOT NULL,
	`new_cents` integer NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `price_changes_sub_idx` ON `price_changes` (`subscription_id`);--> statement-breakpoint
DROP INDEX `emails_address_unique`;--> statement-breakpoint
ALTER TABLE `emails` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `pay_methods` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `usage` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `deleted_at` text;