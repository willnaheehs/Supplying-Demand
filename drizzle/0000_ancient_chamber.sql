CREATE TABLE `catalog_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_records` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`origin` text NOT NULL,
	`created_by` text,
	`body` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_origin_owner` ON `catalog_records` (`origin`,`created_by`);