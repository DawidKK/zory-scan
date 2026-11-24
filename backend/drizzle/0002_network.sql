CREATE TABLE `cabinets` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`address` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cabinets_number_unique` ON `cabinets` (`number`);--> statement-breakpoint
CREATE TABLE `circuits` (
	`id` text PRIMARY KEY NOT NULL,
	`cabinet_id` text NOT NULL,
	`number` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `circuits_cabinet_number_uq` ON `circuits` (`cabinet_id`,`number`);--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`point_id` text NOT NULL,
	`suffix` text,
	`phase` text,
	`power_w` integer,
	`model` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`point_id`) REFERENCES `points`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fixtures_point_idx` ON `fixtures` (`point_id`);--> statement-breakpoint
ALTER TABLE `points` ADD `circuit_id` text REFERENCES circuits(id);--> statement-breakpoint
ALTER TABLE `points` ADD `parent_id` text REFERENCES points(id);--> statement-breakpoint
ALTER TABLE `points` ADD `number` text;--> statement-breakpoint
ALTER TABLE `points` ADD `inventory_id` text;--> statement-breakpoint
ALTER TABLE `points` ADD `status` text DEFAULT 'existing' NOT NULL;--> statement-breakpoint
ALTER TABLE `points` ADD `cable_length` real;--> statement-breakpoint
ALTER TABLE `points` ADD `cable_type` text;--> statement-breakpoint
CREATE INDEX `points_circuit_idx` ON `points` (`circuit_id`);--> statement-breakpoint
CREATE INDEX `points_parent_idx` ON `points` (`parent_id`);