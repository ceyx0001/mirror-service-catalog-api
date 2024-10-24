import { items, SelectItem } from "../../schemas/itemsSchema";
import db from "../../db";
import { Filters, mapItemsToShop } from "../search";
import { asc, gt, inArray } from "drizzle-orm";
import * as andStrategy from "./andStrategies";
import { catalog, SelectCatalog } from "../../schemas/catalogSchema";
import { SelectMod } from "../../schemas/modsSchema";

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
        cursorKey: cursors.threadIndex,
        cursorCol: "threadIndex",
      },
      {
        filter: filters.baseFilters,
        strategy: andStrategy.andBaseFilter,
        cursorKey: cursors.threadIndex,
        cursorCol: "threadIndex",
      },
      {
        filter: filters.modFilters,
        strategy: andStrategy.andModFilter,
        cursorKey: cursors.itemId,
        cursorCol: "itemId",
      },
    ];

    let filteredTable: SelectMod[] | Error;

    for (let filterObj of filtersArray) {
      filteredTable = await filterObj.strategy.apply(
        filterObj.filter,
        filteredTable,
        filterObj.cursorKey,
        filterObj.cursorCol,
        limit
      );
    }

    // need to not use entire table if the previous filter didnt do anything -> test searching for a title only that doesnt exist
    if (
      filteredTable &&
      filteredTable instanceof Array &&
      filteredTable.length > 0
    ) {
      const itemIdSet = new Set<string>();
      const itemIdCursor = filteredTable[filteredTable.length - 1].itemId;
      filteredTable.map((mod: { itemId: string }) => itemIdSet.add(mod.itemId));
      const itemIds: string[] = Array.from(itemIdSet);
      const result = await db.query.items.findMany({
        where: inArray(items.itemId, itemIds),
        columns: { threadIndex: false },
        with: {
          mods: { columns: { itemId: false } },
          catalog: { columns: { views: false } },
        },
      });
      const res = Array.from(mapItemsToShop(result));
      return { array: res, cursor: itemIdCursor };
    }
    return { array: [], cursor: null };
  } catch (error) {
    console.error(error);
  }
}
