import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { InferSelectModel, relations, sql } from "drizzle-orm";
import { catalog } from "./catalogSchema";
import { mods } from "./modsSchema";

export const items = pgTable(
  "items",
  {
    itemId: text("itemId").primaryKey(),
    fee: integer("fee"),
    icon: text("icon"),
    name: text("name"),
    baseType: text("baseType"),
    quality: text("quality"),
    threadIndex: integer("threadIndex")
      .notNull()
      .references(() => catalog.threadIndex, { onUpdate: "cascade" }),
  },
  (table) => ({
    nameSearchIndex: index("nameSearchIndex").using(
      `gin`,
      sql`to_tsvector('simple', ${table.name})`,
      table.name
    ),
    baseTypeSearchIndex: index("baseTypeSearchIndex").using(
      `gin`,
      sql`to_tsvector('simple', ${table.baseType})`,
      table.baseType
    ),
    itemsIdIndex: index("itemsIdIndex").using(`btree`, table.itemId.desc()),
  })
);

export const itemsRelations = relations(items, ({ one, many }) => ({
  catalog: one(catalog, {
    fields: [items.threadIndex],
    references: [catalog.threadIndex],
  }),
  mods: many(mods),
}));

export type SelectItem = InferSelectModel<typeof items>;
