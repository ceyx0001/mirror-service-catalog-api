import { items } from "../../schemas/itemsSchema";
import { db } from "../../db";
import { Filters, mapItemsToShop } from "../search";
import { inArray } from "drizzle-orm";
import * as andStrategy from "./andStrategies";

export type Cursor = {
  cursorKey: unknown;
  cursorCol: string;
  discovered: boolean;
};

export type Paginate = {
  limit: number;
  cursors: Cursor[];
};

export async function getItems(
  filters: Filters,
  cursors: { threadIndex: string; itemId: string },
  limit: number
): Promise<{ array: object[]; cursor: string }> {
  try {
    let filtersArray = [
      {
        filter: filters.titleFilters,
        strategy: andStrategy.andTitleFilter,
        paginate: {
          limit: limit,
          cursors: [
            {
              cursorKey: cursors.threadIndex,
              cursorCol: "threadIndex",
              discovered: false,
            },
          ],
        },
      },
      {
        filter: filters.baseFilters,
        strategy: andStrategy.andBaseFilter,
        paginate: {
          limit: limit,
          cursors: [
            {
              cursorKey: cursors.threadIndex,
              cursorCol: "threadIndex",
              discovered: false,
            },
          ],
        },
      },
      {
        filter: filters.modFilters,
        strategy: andStrategy.andModFilter,
        paginate: {
          limit: limit,
          cursors: [
            {
              cursorKey: cursors.threadIndex,
              cursorCol: "threadIndex",
              discovered: false,
            },
          ],
        },
      },
    ];

    function noResult(filtersArray) {
      return filtersArray.every((filterObj) => {
        return filterObj.paginate.cursors.every(
          (cursor: Cursor) => cursor.cursorKey === undefined
        );
      });
    }

    let filteredTable: { [column: string]: any }[] = [];
    do {
      filteredTable = [];
      for (let filterObj of filtersArray) {
        const copy = [...filterObj.filter];
        filteredTable = await filterObj.strategy.apply(
          copy,
          filteredTable,
          filterObj.paginate
        );
      }
    } while (
      filteredTable instanceof Array &&
      filteredTable.length === 0 &&
      !noResult(filtersArray)
    );
    /*

    filtersArray.forEach((e) => {
      console.log(e.paginate);
    });

*/
    // need to not use entire table if the previous filter didnt do anything -> test searching for a title only that doesnt exist
    if (
      filteredTable &&
      filteredTable instanceof Array &&
      filteredTable.length > 0
    ) {
      const itemIdSet = new Set<string>();
      const cursorKey = filteredTable[filteredTable.length - 1].threadIndex;
      filteredTable.map((mod: { itemId: string }) => itemIdSet.add(mod.itemId));
      const itemIds: string[] = Array.from(itemIdSet);
      const result = await db.query.items.findMany({
        where: inArray(items.itemId, itemIds),
        columns: { threadIndex: false },
        with: {
          mods: { columns: { itemId: false } },
          catalog: { columns: { views: false } },
        },
        orderBy: items.threadIndex,
      });
      const res = Array.from(mapItemsToShop(result));
      return {
        array: res,
        cursor: cursorKey,
      };
    }
    return { array: [], cursor: null };
  } catch (error) {
    console.error(error);
  }
}
