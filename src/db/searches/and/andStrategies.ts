import db from "../../db";
import { PgTable } from "drizzle-orm/pg-core";
import { and, asc, desc, gt, gte, inArray, lt, SQL, sql } from "drizzle-orm";
import { catalog, SelectCatalog } from "../../schemas/catalogSchema";
import { items, SelectItem } from "../../schemas/itemsSchema";
import { mods } from "../../schemas/modsSchema";

type Strategy = {
  apply: (
    filter: string[],
    table: any,
    cursorKey: string | number,
    cursorCol: string,
    limit: number
  ) => Promise<[] | Error>;
};

async function applyFilters(
  filters: string[],
  parentTable: PgTable,
  keyCol: string,
  columns: string[],
  paginate?: { limit: number; cursorKey: string | number; cursorCol: string }
): Promise<[] | Error> {
  try {
    function fullTextSearchQuery(searchTerm: string) {
      // its using stemming and tokenization
      const columnConcatenation = columns
        .map((column) => sql`COALESCE(${parentTable[column]}, '')`)
        .reduce((acc, col) => sql`${acc} || ' ' || ${col}`);

      return sql`to_tsvector('simple', ${columnConcatenation}) @@ phraseto_tsquery('simple', ${searchTerm})`;
    }

    let sq: { [x: string]: SQL.Aliased<unknown> };
    if (paginate) {
      sq = db.$with("sq").as(
        db
          .select()
          .from(parentTable)
          .orderBy(desc(parentTable[paginate.cursorCol]))
          .where(
            and(
              paginate.cursorKey
                ? lt(parentTable[paginate.cursorCol], paginate.cursorKey)
                : undefined,
              fullTextSearchQuery(filters.pop())
            )
          )
      );
      for (let i = 0; i < filters.length; i++) {
        sq = db.$with("sq").as(
          db
            .with(sq)
            .select()
            .from(sq)
            .orderBy(desc(sq[paginate.cursorCol]))
            .where(
              and(
                paginate.cursorKey
                  ? lt(sq[paginate.cursorCol], paginate.cursorKey)
                  : undefined,
                inArray(
                  sq[keyCol],
                  db
                    .select({ [keyCol]: parentTable[keyCol] })
                    .from(parentTable)
                    .where(fullTextSearchQuery(filters[i]))
                )
              )
            )
        );
      }

      return db
        .with(sq)
        .select()
        .from(sq)
        .where(
          paginate.cursorKey
            ? lt(sq[paginate.cursorCol], paginate.cursorKey)
            : undefined
        )
        .limit(paginate.limit)
        .prepare()
        .execute();
    } else {
      sq = db.$with("sq").as(
        db
          .select()
          .from(parentTable)
          .where(and(fullTextSearchQuery(filters.pop())))
      );
      for (let i = 0; i < filters.length; i++) {
        sq = db.$with("sq").as(
          db
            .with(sq)
            .select()
            .from(sq)
            .where(
              inArray(
                sq[keyCol],
                db
                  .select({ [keyCol]: parentTable[keyCol] })
                  .from(parentTable)
                  .where(fullTextSearchQuery(filters[i]))
              )
            )
        );
      }
      return db.with(sq).select().from(sq).prepare().execute();
    }
  } catch (error) {
    console.error(error);
  }
}

export const andTitleFilter: Strategy = {
  apply: async (filter, table = catalog, cursorKey, cursorCol, limit) => {
    if (!filter) {
      return null;
    }
    return await applyFilters(filter, table, "threadIndex", ["title"], {
      limit,
      cursorKey,
      cursorCol,
    });
  },
};

export const andBaseFilter: Strategy = {
  apply: async (
    filter,
    table: SelectCatalog[],
    cursorKey,
    cursorCol,
    limit
  ) => {
    if (table && table.length === 0) {
      return [];
    }

    let filteredBase: PgTable;
    if (table) {
      const threadIndexes = table.map((shop) => shop.threadIndex);
      filteredBase = await db
        .select()
        .from(items)
        .where(inArray(items.threadIndex, threadIndexes))
        .as("filteredBase");
    } else {
      filteredBase = items;
    }

    if (!filter) {
      return await db.select().from(filteredBase);
    }

    return await applyFilters(
      filter,
      filteredBase,
      "itemId",
      ["baseType", "name", "quality"],
      {
        limit,
        cursorKey,
        cursorCol,
      }
    );
  },
};

export const andModFilter: Strategy = {
  apply: async (filter, table: SelectItem[], cursorKey, cursorCol, limit) => {
    if (table && table.length === 0) {
      return [];
    }

    let filteredMods: PgTable;
    if (table && table.length > 0) {
      const itemIds = table.map((item) => item.itemId);
      filteredMods = await db
        .select()
        .from(mods)
        .where(inArray(mods.itemId, itemIds))
        .as("filteredMods");
    } else {
      filteredMods = mods;
    }

    if (!filter) {
      return await db.select().from(filteredMods);
    }
    return await applyFilters(filter, filteredMods, "itemId", ["mod"], {
      limit,
      cursorKey,
      cursorCol,
    });
  },
};
