CREATE TABLE `counters` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`initial_value` integer DEFAULT 0 NOT NULL,
	`current_value` integer DEFAULT 0 NOT NULL,
	`color` text DEFAULT '#b4553d' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
