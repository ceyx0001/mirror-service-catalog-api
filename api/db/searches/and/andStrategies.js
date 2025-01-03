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
Object.defineProperty(exports, "__esModule", { value: true });
exports.andModFilter = exports.andBaseFilter = exports.andTitleFilter = void 0;
const db_1 = require("../../db");
const drizzle_orm_1 = require("drizzle-orm");
const catalogSchema_1 = require("../../schemas/catalogSchema");
const itemsSchema_1 = require("../../schemas/itemsSchema");
const modsSchema_1 = require("../../schemas/modsSchema");
function applyFilters(filters, parentTable, keyCol, columns, paginate) {
    return __awaiter(this, void 0, void 0, function* () {
        function fullTextSearchQuery(searchTerm) {
            const columnConcatenation = columns
                .map((column) => (0, drizzle_orm_1.sql) `COALESCE(${parentTable[column]}, '')`)
                .reduce((acc, col) => (0, drizzle_orm_1.sql) `${acc} || ' ' || ${col}`);
            return (0, drizzle_orm_1.sql) `to_tsvector('simple', ${columnConcatenation}) @@ phraseto_tsquery('simple', ${searchTerm})`;
        }
        function orderByParams(parentTable) {
            const params = [];
            paginate.cursors.forEach((cursor) => {
                if (cursor.cursorCol) {
                    params.push((0, drizzle_orm_1.asc)(parentTable[cursor.cursorCol]));
                }
            });
            return params;
        }
        function gtParams(parentTable) {
            const params = [];
            paginate.cursors.forEach((cursor) => {
                if (cursor.cursorKey && cursor.cursorCol) {
                    params.push((0, drizzle_orm_1.gt)(parentTable[cursor.cursorCol], cursor.cursorKey));
                }
            });
            return params;
        }
        let sq;
        try {
            if (paginate) {
                sq = db_1.db.$with("sq").as(db_1.db
                    .select()
                    .from(parentTable)
                    .orderBy(...orderByParams(parentTable))
                    .where((0, drizzle_orm_1.and)(...gtParams(parentTable), fullTextSearchQuery(filters.pop()))));
                for (let i = 0; i < filters.length; i++) {
                    sq = db_1.db.$with("sq").as(db_1.db
                        .with(sq)
                        .select()
                        .from(sq)
                        .orderBy(...orderByParams(sq))
                        .where((0, drizzle_orm_1.and)(...gtParams(sq), (0, drizzle_orm_1.inArray)(sq[keyCol], db_1.db
                        .select({ [keyCol]: parentTable[keyCol] })
                        .from(parentTable)
                        .where(fullTextSearchQuery(filters[i]))))));
                }
                try {
                    const prepared = db_1.db
                        .with(sq)
                        .select()
                        .from(sq)
                        .limit(paginate.limit)
                        .prepare("p1");
                    const res = yield prepared.execute();
                    if (res instanceof Array && res.length > 0) {
                        const lastRes = res[res.length - 1];
                        paginate.cursors.forEach((cursor) => {
                            if (lastRes && lastRes[cursor.cursorCol]) {
                                cursor.cursorKey = `${lastRes[cursor.cursorCol]}`;
                                cursor.discovered = true;
                            }
                        });
                    }
                    else {
                        paginate.cursors.forEach((cursor) => {
                            cursor.discovered = false;
                        });
                    }
                    return res;
                }
                catch (error) {
                    throw new Error("Failed to execute prepared query with pagination: " + error);
                }
            }
            else {
                sq = db_1.db.$with("sq").as(db_1.db
                    .select()
                    .from(parentTable)
                    .where((0, drizzle_orm_1.and)(fullTextSearchQuery(filters.pop()))));
                for (let i = 0; i < filters.length; i++) {
                    sq = db_1.db.$with("sq").as(db_1.db
                        .with(sq)
                        .select()
                        .from(sq)
                        .where((0, drizzle_orm_1.inArray)(sq[keyCol], db_1.db
                        .select({ [keyCol]: parentTable[keyCol] })
                        .from(parentTable)
                        .where(fullTextSearchQuery(filters[i])))));
                }
                try {
                    const prepared = db_1.db.with(sq).select().from(sq).prepare("p2");
                    return yield prepared.execute();
                }
                catch (error) {
                    throw new Error("Failed to execute prepared query: " + error);
                }
            }
        }
        catch (error) {
            throw new Error("Failed to build query: " + error);
        }
    });
}
exports.andTitleFilter = {
    apply: (filter, table, paginate) => __awaiter(void 0, void 0, void 0, function* () {
        if (filter.length === 0) {
            return table;
        }
        if (!table) {
            table = catalogSchema_1.catalog;
        }
        return yield applyFilters(filter, table, "threadIndex", ["title"], paginate);
    }),
};
exports.andBaseFilter = {
    apply: (filter, table, paginate) => __awaiter(void 0, void 0, void 0, function* () {
        if (!filter) {
            return table;
        }
        let filteredBase;
        if (table) {
            const threadIndexes = table.map((shop) => shop.threadIndex);
            filteredBase = yield db_1.db
                .select()
                .from(itemsSchema_1.items)
                .where((0, drizzle_orm_1.inArray)(itemsSchema_1.items.threadIndex, threadIndexes))
                .as("filteredBase");
        }
        else {
            filteredBase = itemsSchema_1.items;
        }
        if (filter.length === 0) {
            return yield db_1.db.select().from(filteredBase);
        }
        const res = yield applyFilters(filter, filteredBase, "itemId", ["baseType", "name", "quality"], paginate);
        return res;
    }),
};
exports.andModFilter = {
    apply: (filter, table, paginate) => __awaiter(void 0, void 0, void 0, function* () {
        if (!filter) {
            return table;
        }
        let filteredMods;
        if (table) {
            const itemIds = table.map((item) => item.itemId);
            filteredMods = yield db_1.db
                .select()
                .from(modsSchema_1.mods)
                .where((0, drizzle_orm_1.inArray)(modsSchema_1.mods.itemId, itemIds))
                .as("filteredMods");
        }
        else {
            filteredMods = modsSchema_1.mods;
        }
        if (filter.length === 0) {
            return yield db_1.db.select().from(filteredMods);
        }
        const res = yield applyFilters(filter, filteredMods, "itemId", ["mod"], paginate);
        return res;
    }),
};
