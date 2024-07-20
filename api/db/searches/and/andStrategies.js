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
exports.andModFilter = exports.andBaseFilter = exports.andTitleFilter = void 0;
const db_1 = __importDefault(require("../../db"));
const drizzle_orm_1 = require("drizzle-orm");
const catalogSchema_1 = require("../../schemas/catalogSchema");
const itemsSchema_1 = require("../../schemas/itemsSchema");
const modsSchema_1 = require("../../schemas/modsSchema");
function applyFilters(filters, parentTable, key, columns) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            function fullTextSearchQuery(searchTerm) {
                const columnConcatenation = columns
                    .map((column) => (0, drizzle_orm_1.sql) `${parentTable[column]}`)
                    .reduce((acc, col) => (0, drizzle_orm_1.sql) `${acc} || ' ' || ${col}`);
                return (0, drizzle_orm_1.sql) `to_tsvector('english', ${columnConcatenation}) @@ phraseto_tsquery('english', ${searchTerm})`;
            }
            let sq = db_1.default
                .$with("sq")
                .as(db_1.default.select().from(parentTable).where(fullTextSearchQuery(filters.pop())));
            for (let i = 0; i < filters.length; i++) {
                sq = db_1.default.$with("sq").as(db_1.default
                    .with(sq)
                    .select()
                    .from(sq)
                    .where((0, drizzle_orm_1.inArray)(sq[key], db_1.default
                    .select({ [key]: parentTable[key] })
                    .from(parentTable)
                    .where(fullTextSearchQuery(filters[i])))));
            }
            const prepared = db_1.default.with(sq).select().from(sq).prepare();
            return yield prepared.execute();
        }
        catch (error) {
            console.error(error);
        }
    });
}
exports.andTitleFilter = {
    apply: (filter_1, ...args_1) => __awaiter(void 0, [filter_1, ...args_1], void 0, function* (filter, table = catalogSchema_1.catalog) {
        if (!filter) {
            return null;
        }
        return yield applyFilters(filter, table, "threadIndex", ["title"]);
    }),
};
exports.andBaseFilter = {
    apply: (filter, table) => __awaiter(void 0, void 0, void 0, function* () {
        if (table && table.length === 0) {
            return [];
        }
        let filteredBase;
        if (table) {
            const threadIndexes = table.map((shop) => shop.threadIndex);
            filteredBase = yield db_1.default
                .select()
                .from(itemsSchema_1.items)
                .where((0, drizzle_orm_1.inArray)(itemsSchema_1.items.shopId, threadIndexes))
                .as("filteredBase");
        }
        else {
            filteredBase = itemsSchema_1.items;
        }
        if (!filter) {
            return yield db_1.default.select().from(filteredBase);
        }
        return yield applyFilters(filter, filteredBase, "itemId", [
            "baseType",
            "name",
            "quality",
        ]);
    }),
};
exports.andModFilter = {
    apply: (filter, table) => __awaiter(void 0, void 0, void 0, function* () {
        if (table && table.length === 0) {
            return [];
        }
        let filteredMods;
        if (table && table.length > 0) {
            const itemIds = table.map((item) => item.itemId);
            filteredMods = yield db_1.default
                .select()
                .from(modsSchema_1.mods)
                .where((0, drizzle_orm_1.inArray)(modsSchema_1.mods.itemId, itemIds))
                .as("filteredMods");
        }
        else {
            filteredMods = modsSchema_1.mods;
        }
        if (!filter) {
            return yield db_1.default.select().from(filteredMods);
        }
        return yield applyFilters(filter, filteredMods, "itemId", ["mod"]);
    }),
};
