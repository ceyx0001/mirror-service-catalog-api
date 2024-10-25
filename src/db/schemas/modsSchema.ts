import { pgTable, text, integer, primaryKey, index } from "drizzle-orm/pg-core";
import { InferSelectModel, relations, sql } from "drizzle-orm";
import { items } from "./itemsSchema";
import { catalog } from "./catalogSchema";

export const mods = pgTable(
  "mods",
  {
    mod: text("mod"),
    type: text("type"),
    dupes: integer("dupes"),
    itemId: text("itemId").references(() => items.itemId),
    threadIndex: integer("threadIndex")
      .notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mod, table.type, table.itemId] }),
    modSearchIndex: index("modSearchIndex").using(
      `gin`, sql`to_tsvector('simple', ${table.mod})`,
      table.mod
    ),
    modsItemIdIndexDesc: index("modsItemIdIndex").using("btree", table.mod.desc()),
    modsThreadIndexDesc: index("modsThreadIndexDesc").using(
      "btree",
      table.threadIndex.desc()
    ),
  })
);

export const modsRelations = relations(mods, ({ one }) => ({
  item: one(items, {
    fields: [mods.itemId],
    references: [items.itemId],
  }),
}));

export type SelectMod = InferSelectModel<typeof mods>;
