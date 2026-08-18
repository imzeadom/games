import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const counters = sqliteTable(
  "counters",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    initialValue: integer("initial_value").notNull().default(0),
    currentValue: integer("current_value").notNull().default(0),
    color: text("color").notNull().default("#b4553d"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    ownerIndex: index("idx_counters_owner_id").on(table.ownerId),
  }),
);
