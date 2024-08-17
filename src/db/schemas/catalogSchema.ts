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
    titleSearchIndex: index("titleSearchIndex")
      .on(table.title)
      .using(sql`gin(to_tsvector('simple', ${table.title}))`),
    viewsIndex: index("viewsIndex").on(table.views).desc(),
    threadDescIndex: index("threadDescIndex").on(table.threadIndex).asc(),
  })
);

export const catalogRelations = relations(catalog, ({ many }) => ({
  items: many(items),
}));

export type SelectCatalog = InferSelectModel<typeof catalog>;
