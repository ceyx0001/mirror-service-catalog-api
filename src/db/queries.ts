import { db, pool } from "./db";
import { catalog } from "./schemas/catalogSchema";
import { SelectItem } from "./schemas/itemsSchema";
import { SelectMod } from "./schemas/modsSchema";
import { asc, desc, gt } from "drizzle-orm";
import { filterItems, groupMods, Filters } from "./searches/search";
import Papa from "papaparse";
import { pipeline } from "stream";
import { from as copyFrom } from "pg-copy-streams";
import fs from "fs";
import path from "path";

export async function updateCatalog(shops) {
  const itemsToInsert: Map<string, SelectItem> = new Map();
  const modsToInsert: Map<string, SelectMod> = new Map();

  function setMods(itemId, modType, mods, threadIndex) {
    for (const text of mods) {
      const key = itemId + modType + text;
      const existingMod = modsToInsert.get(key);
      if (existingMod) {
        existingMod.dupes += 1;
      } else {
        modsToInsert.set(key, {
          mod: text,
          type: modType,
          dupes: 1,
          itemId,
          threadIndex,
        });
      }
    }
  }

  function aggregateMods(item, threadIndex) {
    const modKeys = [
      "enchant",
      "implicit",
      "explicit",
      "fractured",
      "crafted",
      "crucible",
    ];
    modKeys.forEach((key) => {
      const fullKey = `${key}Mods`; // Add the "Mods" suffix when accessing properties
      if (item[fullKey]) setMods(item.id, key, item[fullKey], threadIndex);
    });
  }

  async function copyCSVToTable(client, filePath, tableName) {
    return new Promise<void>((resolve, reject) => {
      const stream = client.query(
        copyFrom(`COPY ${tableName} FROM STDIN WITH DELIMITER ',' CSV HEADER`)
      );
      const fileStream = fs.createReadStream(filePath);

      pipeline(fileStream, stream, (err) => {
        if (err) {
          console.error("Import failed:", err);
          return reject(err);
        }
        resolve();
      });
    });
  }

  const shopsToInsert = [];
  shops.forEach((shop) => {
    if (shop) {
      let hasItems = false;
      shop.items.forEach((item) => {
        if (!itemsToInsert.has(item.id)) {
          hasItems = true;
          const dbItem: SelectItem = {
            itemId: item.id,
            fee: item.fee,
            icon: item.icon,
            name: item.name,
            baseType: item.baseType,
            quality: item.quality,
            threadIndex: shop.threadIndex,
          };
          itemsToInsert.set(item.id, dbItem);
          aggregateMods(item, shop.threadIndex);
        }
      });
      if (shop.items.length > 0 && hasItems) {
        const { items, ...rest } = shop;
        shopsToInsert.push(rest);
      }
    }
  });

  const outputDirectory = path.join(__dirname, "csv");
  fs.writeFileSync(
    path.join(outputDirectory, "catalog.csv"),
    Papa.unparse(shopsToInsert)
  );
  fs.writeFileSync(
    path.join(outputDirectory, "items.csv"),
    Papa.unparse(Array.from(itemsToInsert.values()))
  );
  fs.writeFileSync(
    path.join(outputDirectory, "mods.csv"),
    Papa.unparse(Array.from(modsToInsert.values()))
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const truncate = `TRUNCATE TABLE catalog CASCADE`;
    await client.query(truncate);

    await Promise.all([
      copyCSVToTable(
        client,
        path.join(outputDirectory, "catalog.csv"),
        "catalog"
      ),
      copyCSVToTable(client, path.join(outputDirectory, "items.csv"), "items"),
      copyCSVToTable(client, path.join(outputDirectory, "mods.csv"), "mods"),
    ]);

    await client.query("COMMIT");
    console.log("Catalog loaded successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error loading catalog:", error);
  } finally {
    client.release();
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

export async function getShopsInRange(cursor: {
  threadIndex: number;
  limit: number;
}) {
  try {
    const result = await db.query.catalog.findMany({
      with: {
        items: {
          columns: { threadIndex: false },
          with: {
            mods: { columns: { itemId: false, threadIndex: false } },
          },
        },
      },
      where: cursor ? gt(catalog.threadIndex, cursor.threadIndex) : undefined,
      limit: cursor ? Number(cursor.limit) : undefined,
      orderBy: asc(catalog.threadIndex),
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

export async function getFilteredItems(
  filters: Filters,
  cursors: { threadIndex: string; itemId: string },
  limit: number
) {
  return await filterItems(filters, cursors, limit);
}
