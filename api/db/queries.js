"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
const db_1 = require("./db");
const catalogSchema_1 = require("./schemas/catalogSchema");
const drizzle_orm_1 = require("drizzle-orm");
const search_1 = require("./searches/search");
const papaparse_1 = __importDefault(require("papaparse"));
const stream_1 = require("stream");
const pg_copy_streams_1 = require("pg-copy-streams");
const fs_1 = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const fsFunctions_1 = require("./csv/fsFunctions");
const ALLOWED_TABLES = {
    CATALOG: "catalog",
    ITEMS: "items",
    MODS: "mods",
};
function updateCatalog(shops) {
    return __awaiter(this, void 0, void 0, function* () {
        const itemsToInsert = new Map();
        const modsToInsert = new Map();
        function setMods(itemId, modType, mods, threadIndex) {
            for (const text of mods) {
                const key = itemId + modType + text;
                const existingMod = modsToInsert.get(key);
                if (existingMod) {
                    existingMod.dupes += 1;
                }
                else {
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
                if (item[fullKey])
                    setMods(item.id, key, item[fullKey], threadIndex);
            });
        }
        function copyCSVToTable(client, filePath, tableName) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!Object.values(ALLOWED_TABLES).includes(tableName)) {
                    throw new Error("Invalid table name");
                }
                return new Promise((resolve, reject) => {
                    const stream = client.query((0, pg_copy_streams_1.from)(`COPY ${tableName} FROM STDIN WITH DELIMITER ',' CSV HEADER`));
                    const fileStream = fs_1.default.createReadStream(filePath);
                    (0, stream_1.pipeline)(fileStream, stream, (error) => {
                        if (error) {
                            return reject("Import failed: " + error);
                        }
                        resolve();
                    });
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
                        const dbItem = {
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
                    const { items } = shop, rest = __rest(shop, ["items"]);
                    shopsToInsert.push(rest);
                }
            }
        });
        const outputDirectory = path_1.default.join(__dirname, "csv");
        try {
            yield (0, fsFunctions_1.ensureSecureDirectory)(outputDirectory);
            yield Promise.all([
                (0, fsFunctions_1.writeSecureFile)(path_1.default.join(outputDirectory, "catalog.csv"), papaparse_1.default.unparse(shopsToInsert)),
                (0, fsFunctions_1.writeSecureFile)(path_1.default.join(outputDirectory, "items.csv"), papaparse_1.default.unparse(Array.from(itemsToInsert.values()))),
                (0, fsFunctions_1.writeSecureFile)(path_1.default.join(outputDirectory, "mods.csv"), papaparse_1.default.unparse(Array.from(modsToInsert.values()))),
            ]);
            const client = yield db_1.pool.connect();
            try {
                yield client.query("BEGIN");
                const truncate = `TRUNCATE TABLE catalog CASCADE`;
                yield client.query(truncate);
                yield Promise.all([
                    copyCSVToTable(client, path_1.default.join(outputDirectory, "catalog.csv"), ALLOWED_TABLES.CATALOG),
                    copyCSVToTable(client, path_1.default.join(outputDirectory, "items.csv"), ALLOWED_TABLES.ITEMS),
                    copyCSVToTable(client, path_1.default.join(outputDirectory, "mods.csv"), ALLOWED_TABLES.MODS),
                ]);
                yield client.query("COMMIT");
            }
            catch (error) {
                yield client.query("ROLLBACK");
                throw new Error("Error loading catalog: " + error);
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            const files = ["catalog.csv", "items.csv", "mods.csv"];
            yield Promise.all(files.map((file) => fs_1.promises.unlink(path_1.default.join(outputDirectory, file)).catch(() => { })));
            throw new Error(`Catalog update failed: ${error.message}`);
        }
    });
}
function getThreadsInRange(offset, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield db_1.db
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
        return yield db_1.db.select().from(catalogSchema_1.catalog);
    });
}
function getShopsInRange(cursor) {
    return __awaiter(this, void 0, void 0, function* () {
        if ((cursor === null || cursor === void 0 ? void 0 : cursor.limit) > 50)
            throw new Error("Maximum limit exceeded while getting shops.");
        if ((cursor === null || cursor === void 0 ? void 0 : cursor.threadIndex) < 0)
            throw new Error("Invalid thread index while getting shops. Thread index must be positive.");
        try {
            const result = yield db_1.db.query.catalog.findMany({
                with: {
                    items: {
                        columns: { threadIndex: false },
                        with: {
                            mods: { columns: { itemId: false, threadIndex: false } },
                        },
                    },
                },
                where: cursor ? (0, drizzle_orm_1.gt)(catalogSchema_1.catalog.threadIndex, cursor.threadIndex) : undefined,
                limit: cursor ? Number(cursor.limit) : undefined,
                orderBy: (0, drizzle_orm_1.asc)(catalogSchema_1.catalog.threadIndex),
            });
            for (const shop of result) {
                for (const item of shop.items) {
                    item.mods = (0, search_1.groupMods)(item.mods);
                }
            }
            return result;
        }
        catch (error) {
            throw new Error(`Error getting shops in range: ${error}`);
        }
    });
}
function getFilteredItems(filters, cursors, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield (0, search_1.filterItems)(filters, cursors, limit);
    });
}
