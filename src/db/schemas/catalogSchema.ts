import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { InferSelectModel, relations, sql } from "drizzle-orm";
import { items } from "./itemsSchema";

export const catalog = pgTable(
  "catalog",
  {
    profileName: text("profileName").primaryKey(),
    characterName: text("characterName"),
    threadIndex: integer("threadIndex").unique(),
    views: integer("views"),
    title: text("title"),
  },
  (table) => ({
    titleSearchIndex: index("titleSearchIndex").using(
      `gin`,
      sql`to_tsvector('simple', ${table.title})`,
      table.title
    ),
    catalogViewsIndex: index("catalogViewsIndex").on(table.views),
    catalogThreadIndexDesc: index("catalogThreadIndexDesc").on(
      table.threadIndex.desc()
    ),
  })
);

export const catalogRelations = relations(catalog, ({ many }) => ({
  items: many(items),
}));

export type SelectCatalog = InferSelectModel<typeof catalog>;
