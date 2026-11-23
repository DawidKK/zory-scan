CREATE TABLE `points` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`point_id` text NOT NULL,
	`scanned_at` integer NOT NULL,
	`user_agent` text,
	`lat` real,
	`lng` real,
	FOREIGN KEY (`point_id`) REFERENCES `points`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scans_scanned_at_idx` ON `scans` (`scanned_at`);--> statement-breakpoint
CREATE INDEX `scans_point_id_idx` ON `scans` (`point_id`);