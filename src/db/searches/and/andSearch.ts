import { items } from "../../schemas/itemsSchema";
import { db } from "../../db";
import { Filters, mapItemsToShop } from "../search";
import { inArray } from "drizzle-orm";
import * as andStrategy from "./andStrategies";

export async function getItems(
  filters: Filters,
  cursors: { threadIndex: number; itemId: string },
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
            { cursorKey: cursors.threadIndex, cursorCol: "threadIndex" },
          ],
        },
      },
      {
        filter: filters.baseFilters,
        strategy: andStrategy.andBaseFilter,
        paginate: {
          limit: limit,
          cursors: [
            { cursorKey: cursors.threadIndex, cursorCol: "threadIndex" },
          ],
        },
      },
      {
        filter: filters.modFilters,
        strategy: andStrategy.andModFilter,
        paginate: {
          limit: limit,
          cursors: [
            { cursorKey: cursors.threadIndex, cursorCol: "threadIndex" },
          ],
        },
      },
    ];

    let filteredTable: { [column: string]: any }[];
    for (let filterObj of filtersArray) {
      filteredTable = await filterObj.strategy.apply(
        filterObj.filter,
        filteredTable,
        filterObj.paginate
      );
    }

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
      console.log(res);
      return { array: res, cursor: cursorKey };
    }
    return { array: [], cursor: null };
  } catch (error) {
    console.error(error);
  }
}
