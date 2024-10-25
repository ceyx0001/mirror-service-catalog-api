import { db } from "../../db";
import { PgTable, WithSubqueryWithSelection } from "drizzle-orm/pg-core";
import {
  and,
  asc,
  desc,
  gt,
  inArray,
  lt,
  sql,
  Subquery,
  WithSubquery,
} from "drizzle-orm";
import { catalog, SelectCatalog } from "../../schemas/catalogSchema";
import { items, SelectItem } from "../../schemas/itemsSchema";
import { mods } from "../../schemas/modsSchema";

export type Strategy = {
  apply: (
    filter: string[],
    table: any,
    paginate?: {
      limit: number;
      cursors: { cursorKey: string | number; cursorCol: string }[];
    }
  ) => Promise<
    {
      [x: string]: any;
    }[]
  >;
};

async function applyFilters(
  filters: string[],
  parentTable: PgTable | Subquery,
  keyCol: string,
  columns: string[],
  paginate?: {
    limit: number;
    cursors: { cursorKey: string | number; cursorCol: string }[];
  }
): Promise<
  {
    [x: string]: any;
  }[]
> {
  try {
    function fullTextSearchQuery(searchTerm: string) {
      // its using stemming and tokenization
      const columnConcatenation = columns
        .map((column) => sql`COALESCE(${parentTable[column]}, '')`)
        .reduce((acc, col) => sql`${acc} || ' ' || ${col}`);

      return sql`to_tsvector('simple', ${columnConcatenation}) @@ phraseto_tsquery('simple', ${searchTerm})`;
    }

    function orderByParams(parentTable) {
      const params = [];
      paginate.cursors.forEach((cursor) => {
        if (cursor.cursorCol) {
          params.push(asc(parentTable[cursor.cursorCol]));
        }
      });
      return params;
    }

    function gtParams(parentTable) {
      const params = [];
      paginate.cursors.forEach((cursor) => {
        if (cursor.cursorKey && cursor.cursorCol) {
          params.push(gt(parentTable[cursor.cursorCol], cursor.cursorKey));
        }
      });
      return params;
    }

    let sq:
      | WithSubquery<string, Record<string, unknown>>
      | WithSubqueryWithSelection<any, "sq">;
    if (paginate) {
      sq = db.$with("sq").as(
        db
          .select()
          .from(parentTable)
          .orderBy(...orderByParams(parentTable))
          .where(
            and(...gtParams(parentTable), fullTextSearchQuery(filters.pop()))
          )
      );
      for (let i = 0; i < filters.length; i++) {
        sq = db.$with("sq").as(
          db
            .with(sq)
            .select()
            .from(sq)
            .orderBy(...orderByParams(sq))
            .where(
              and(
                ...gtParams(sq),
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

      const prepared = db
        .with(sq)
        .select()
        .from(sq)
        .limit(paginate.limit)
        .prepare("p1");
      return await prepared.execute();
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
      const prepared = db.with(sq).select().from(sq).prepare("p2");
      return await prepared.execute();
    }
  } catch (error) {
    console.error("Failed to search: " + error);
  }
}

export const andTitleFilter: Strategy = {
  apply: async (filter, table = catalog, paginate) => {
    if (!filter) {
      return null;
    }
    return await applyFilters(
      filter,
      table,
      "threadIndex",
      ["title"],
      paginate
    );
  },
};

export const andBaseFilter: Strategy = {
  apply: async (filter, table: SelectCatalog[], paginate) => {
    if (table && table.length === 0) {
      return [];
    }

    let filteredBase: Subquery | PgTable;
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
      paginate
    );
  },
};

export const andModFilter: Strategy = {
  apply: async (filter, table: SelectItem[], paginate) => {
    if (table && table.length === 0) {
      return [];
    }

    let filteredMods: Subquery | PgTable;
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
    return await applyFilters(
      filter,
      filteredMods,
      "itemId",
      ["mod"],
      paginate
    );
  },
};
