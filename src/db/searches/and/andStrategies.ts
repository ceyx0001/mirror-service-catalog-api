import { db } from "../../db";
import { PgTable, WithSubqueryWithSelection } from "drizzle-orm/pg-core";
import {
  and,
  asc,
  gt,
  inArray,
  sql,
  Subquery,
  WithSubquery,
} from "drizzle-orm";
import { catalog, SelectCatalog } from "../../schemas/catalogSchema";
import { items, SelectItem } from "../../schemas/itemsSchema";
import { mods } from "../../schemas/modsSchema";
import { Paginate } from "./andSearch";

export type Strategy = {
  apply: (
    filter: string[],
    table: any,
    paginate?: Paginate
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
  paginate?: Paginate
): Promise<{ [x: string]: any }[]> {
  function fullTextSearchQuery(searchTerm: string) {
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

  try {
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

      try {
        const prepared = db
          .with(sq)
          .select()
          .from(sq)
          .limit(paginate.limit)
          .prepare("p1");
        const res = await prepared.execute();
        if (res instanceof Array && res.length > 0) {
          const lastRes = res[res.length - 1];
          paginate.cursors.forEach((cursor) => {
            if (lastRes && lastRes[cursor.cursorCol]) {
              cursor.cursorKey = `${lastRes[cursor.cursorCol]}`;
              cursor.discovered = true;
            }
          });
        } else {
          paginate.cursors.forEach((cursor) => {
            cursor.discovered = false;
          });
        }
        return res;
      } catch (error) {
        console.error(
          "Failed to execute prepared query with pagination: " + error
        );
      }
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

      try {
        const prepared = db.with(sq).select().from(sq).prepare("p2");
        return await prepared.execute();
      } catch (error) {
        console.error("Failed to execute prepared query: " + error);
      }
    }
  } catch (error) {
    console.error("Failed to build query: " + error);
  }
}

export const andTitleFilter: Strategy = {
  apply: async (filter, table, paginate) => {
    if (filter.length === 0) {
      return table;
    }
    
    if (!table) {
      table = catalog;
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
    if (!filter) {
      return table;
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

    if (filter.length === 0) {
      return await db.select().from(filteredBase);
    }

    const res = await applyFilters(
      filter,
      filteredBase,
      "itemId",
      ["baseType", "name", "quality"],
      paginate
    );
    return res;
  },
};

export const andModFilter: Strategy = {
  apply: async (filter, table: SelectItem[], paginate) => {
    if (!filter) {
      return table;
    }

    let filteredMods: Subquery | PgTable;
    if (table) {
      const itemIds = table.map((item) => item.itemId);
      filteredMods = await db
        .select()
        .from(mods)
        .where(inArray(mods.itemId, itemIds))
        .as("filteredMods");
    } else {
      filteredMods = mods;
    }

    if (filter.length === 0) {
      return await db.select().from(filteredMods);
    } 

    const res = await applyFilters(
      filter,
      filteredMods,
      "itemId",
      ["mod"],
      paginate
    );
    return res;
  },
};
