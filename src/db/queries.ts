import db from "./db";
import { catalog } from "./schemas/catalogSchema";
import { SelectItem, items } from "./schemas/itemsSchema";
import { SelectMod, mods } from "./schemas/modsSchema";
import { desc, sql, inArray } from "drizzle-orm";
import { filterItems, groupMods, Filters } from "./searches/search";

export async function updateCatalog(shops) {
  function buildConflictUpdateSet(table) {
    const columns = Object.keys(table);
    return columns.reduce((acc, column) => {
      acc[column] = sql`excluded.${sql.identifier(column)}`;
      return acc;
    }, {});
  }

  const itemsToInsert: Map<string, SelectItem> = new Map();
  const modsToInsert: Map<string, SelectMod> = new Map();

  function setMods(itemId: string, modType: string, mods: string[]) {
    if (mods) {
      for (const text of mods) {
        const key = itemId + modType + text;
        if (modsToInsert.get(key)) {
          const oldMod = modsToInsert.get(key);
          oldMod.dupes += 1;
          modsToInsert.set(key, oldMod);
        } else {
          modsToInsert.set(key, {
            itemId: itemId,
            mod: text,
            type: modType,
            dupes: null,
          });
        }
      }
    }
  }

  function aggregateMods(item) {
    for (const key in item) {
      if (item[key]) {
        switch (key) {
          case "enchantMods":
            setMods(item.id, "enchant", item[key]);
            break;
          case "implicitMods":
            setMods(item.id, "implicit", item[key]);
            break;
          case "explicitMods":
            setMods(item.id, "explicit", item[key]);
            break;
          case "fracturedMods":
            setMods(item.id, "fractured", item[key]);
            break;
          case "craftedMods":
            setMods(item.id, "crafted", item[key]);
            break;
          case "crucibleMods":
            setMods(item.id, "crucible", item[key]);
            break;
          default:
        }
      }
    }
  }

  try {
    const shopsToInsert = [];
    shops.forEach((shop) => {
      if (shop) {
        shop.items.forEach((item) => {
          if (!itemsToInsert.has(item.id)) {
            const dbItem: SelectItem = {
              fee: item.fee,
              name: item.name,
              baseType: item.baseType,
              icon: item.icon,
              quality: item.quality,
              itemId: item.id,
              shopId: shop.threadIndex,
            };
            itemsToInsert.set(item.id, dbItem);
            aggregateMods(item);
          }
        });

        if (shop.items.length > 0) {
          shopsToInsert.push(shop);
        }
      }
    });

    const shopsPromise = db
      .insert(catalog)
      .values(shopsToInsert)
      .onConflictDoUpdate({
        target: catalog.profileName,
        set: buildConflictUpdateSet(catalog),
      }); // item already exists but shop is still added

    const uniqueItemsToInsert = Array.from(itemsToInsert.values());
    const itemsPromise = db
      .insert(items)
      .values(uniqueItemsToInsert)
      .onConflictDoUpdate({
        target: items.itemId,
        set: buildConflictUpdateSet(items),
      });

    const uniqueModsToInsert = Array.from(modsToInsert.values());
    const itemIds = uniqueModsToInsert.map((mod) => mod.itemId);
    await db.delete(mods).where(inArray(mods.itemId, itemIds));

    const modsPromise = db
      .insert(mods)
      .values(uniqueModsToInsert)
      .onConflictDoNothing();

    await Promise.all([shopsPromise, itemsPromise, modsPromise]);
  } catch (error) {
    console.log(error);
  }
}

export async function getThreadsInRange(offset, limit) {
  return await db
    .select({
      profileName: catalog.profileName,
      threadIndex: catalog.threadIndex,
      title: catalog.title,
    })
    .from(catalog)
    .orderBy(desc(catalog.views))
    .offset(offset)
    .limit(limit);
}

export async function getAllThreads() {
  return await db.select().from(catalog);
}

export async function getShopsInRange(offset, limit) {
  try {
    const result = await db.query.catalog.findMany({
      columns: { views: false },
      with: {
        items: {
          columns: { shopId: false },
          with: {
            mods: { columns: { itemId: false } },
          },
        },
      },
      offset: offset,
      limit: limit,
    });

    for (const shop of result) {
      for (const item of shop.items) {
        item.mods = groupMods(item.mods);
      }
    }

    return result;
  } catch (error) {
    console.error(error);
  }
}

export async function getFilteredItems(filters: Filters) {
  return filterItems(filters);
}
