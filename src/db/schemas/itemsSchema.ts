import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { InferSelectModel, relations, sql } from "drizzle-orm";
import { catalog } from "./catalogSchema";
import { mods } from "./modsSchema";

export const items = pgTable(
  "items",
  {
    itemId: text("itemId").primaryKey().notNull(),
    fee: integer("fee"),
    icon: text("icon"),
    name: text("name"),
    baseType: text("baseType"),
    quality: text("quality"),
    shopId: integer("shopId")
      .notNull()
      .references(() => catalog.threadIndex, { onUpdate: "cascade" }),
  },
  (table) => ({
    nameSearchIndex: index("nameSearchIndex")
      .on(table.name)
      .using(sql`gin(to_tsvector('english', ${table.name}))`),
    baseTypeSearchIndex: index("baseTypeSearchIndex")
      .on(table.baseType)
      .using(sql`gin(to_tsvector('english', ${table.baseType}))`),
  })
);

export const itemsRelations = relations(items, ({ one, many }) => ({
  catalog: one(catalog, {
    fields: [items.shopId],
    references: [catalog.threadIndex],
  }),
  mods: many(mods),
}));

export type SelectItem = InferSelectModel<typeof items>;
