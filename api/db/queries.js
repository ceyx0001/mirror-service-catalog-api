"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCatalog = updateCatalog;
exports.getThreadsInRange = getThreadsInRange;
exports.getAllThreads = getAllThreads;
exports.getShopsInRange = getShopsInRange;
exports.getFilteredItems = getFilteredItems;
const db_1 = __importDefault(require("./db"));
const catalogSchema_1 = require("./schemas/catalogSchema");
const itemsSchema_1 = require("./schemas/itemsSchema");
const modsSchema_1 = require("./schemas/modsSchema");
const drizzle_orm_1 = require("drizzle-orm");
const search_1 = require("./searches/search");
function updateCatalog(shops) {
    return __awaiter(this, void 0, void 0, function* () {
        function buildConflictUpdateSet(table) {
            const columns = Object.keys(table);
            return columns.reduce((acc, column) => {
                acc[column] = (0, drizzle_orm_1.sql) `excluded.${drizzle_orm_1.sql.identifier(column)}`;
                return acc;
            }, {});
        }
        const itemsToInsert = new Map();
        const modsToInsert = new Map();
        function setMods(itemId, modType, mods) {
            if (mods) {
                for (const text of mods) {
                    const key = itemId + modType + text;
                    if (modsToInsert.get(key)) {
                        const oldMod = modsToInsert.get(key);
                        oldMod.dupes += 1;
                        modsToInsert.set(key, oldMod);
                    }
                    else {
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
                    let hasItems = false;
                    shop.items.forEach((item) => {
                        if (!itemsToInsert.has(item.id)) {
                            hasItems = true;
                            const dbItem = {
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
                    if (shop.items.length > 0 && hasItems) {
                        shopsToInsert.push(shop);
                    }
                }
            });
            const shopsPromise = db_1.default
                .insert(catalogSchema_1.catalog)
                .values(shopsToInsert)
                .onConflictDoUpdate({
                target: catalogSchema_1.catalog.profileName,
                set: buildConflictUpdateSet(catalogSchema_1.catalog),
            }); // item already exists but shop is still added
            const uniqueItemsToInsert = Array.from(itemsToInsert.values());
            const itemsPromise = db_1.default
                .insert(itemsSchema_1.items)
                .values(uniqueItemsToInsert)
                .onConflictDoUpdate({
                target: itemsSchema_1.items.itemId,
                set: buildConflictUpdateSet(itemsSchema_1.items),
            });
            const uniqueModsToInsert = Array.from(modsToInsert.values());
            const itemIds = uniqueModsToInsert.map((mod) => mod.itemId);
            yield db_1.default.delete(modsSchema_1.mods).where((0, drizzle_orm_1.inArray)(modsSchema_1.mods.itemId, itemIds));
            const modsPromise = db_1.default
                .insert(modsSchema_1.mods)
                .values(uniqueModsToInsert)
                .onConflictDoNothing();
            yield Promise.all([shopsPromise, itemsPromise, modsPromise]);
        }
        catch (error) {
            console.log(error);
        }
    });
}
function getThreadsInRange(offset, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield db_1.default
            .select({
            profileName: catalogSchema_1.catalog.profileName,
            threadIndex: catalogSchema_1.catalog.threadIndex,
            title: catalogSchema_1.catalog.title,
        })
            .from(catalogSchema_1.catalog)
            .orderBy((0, drizzle_orm_1.desc)(catalogSchema_1.catalog.views))
            .offset(offset)
            .limit(limit);
    });
}
function getAllThreads() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield db_1.default.select().from(catalogSchema_1.catalog);
    });
}
function getShopsInRange(offset, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield db_1.default.query.catalog.findMany({
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
                    item.mods = (0, search_1.groupMods)(item.mods);
                }
            }
            return result;
        }
        catch (error) {
            console.error(error);
        }
    });
}
function getFilteredItems(filters) {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, search_1.filterItems)(filters);
    });
}
