import * as andSearch from "./and/andSearch";


export type Filters = {
  modFilters: string[];
  baseFilters: string[];
  titleFilters: string[];
};


function addDupes(str, count) {
  const val = parseInt(str.split("%")[0].split().pop());
  const newVal = val * count;
  return str.replace(val, newVal);
}

export function groupMods(mods) {
  const modsMap = new Map();
  for (const mod of mods) {
    const key = mod.type;
    if (mod.dupes > 1) {
      mod.mod = addDupes(mod.mod, mod.dupes);
    }
    if (modsMap.get(key)) {
      modsMap.get(key).push(mod.mod);
    } else {
      modsMap.set(key, [mod.mod]);
    }
  }
  return Object.fromEntries(modsMap);
}

export function mapItemsToShop(items) {
  let shopsMap = new Map();
  for (const item of items) {
    const key = item.catalog.profileName;
    const { catalog, ...itemDetails } = item;
    const modsGroup = groupMods(itemDetails.mods);
    if (shopsMap.get(key)) {
      shopsMap.get(key).items.push({ ...itemDetails, mods: modsGroup });
    } else {
      shopsMap.set(key, {
        ...catalog,
        items: [{ ...itemDetails, mods: modsGroup }],
      });
    }
  }
  return shopsMap.values();
}

export async function filterItems(
  filters: Filters,
  cursors: { threadIndex: string; itemId: string },
  limit: number
): Promise<{
  array: object[];
  cursor: string;
}> {
  try {
    let res = await andSearch.getItems(filters, cursors, limit);
    return res;
  } catch (error) {
    console.error(error);
  }
}