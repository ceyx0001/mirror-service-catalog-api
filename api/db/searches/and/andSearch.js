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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getItems = getItems;
const itemsSchema_1 = require("../../schemas/itemsSchema");
const db_1 = require("../../db");
const search_1 = require("../search");
const drizzle_orm_1 = require("drizzle-orm");
const andStrategy = __importStar(require("./andStrategies"));
function getItems(filters, cursors, limit) {
    return __awaiter(this, void 0, void 0, function* () {
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
                    if (filterObj.filter && filterObj.filter.length > 0) {
                        return filterObj.paginate.cursors.every((cursor) => !cursor.discovered);
                    }
                    return true;
                });
            }
            let filteredTable;
            do {
                filteredTable = undefined;
                for (let filterObj of filtersArray) {
                    const copy = [...filterObj.filter];
                    filteredTable = yield filterObj.strategy.apply(copy, filteredTable, filterObj.paginate);
                }
            } while (filteredTable instanceof Array &&
                filteredTable.length === 0 &&
                !noResult(filtersArray));
            // need to not use entire table if the previous filter didnt do anything -> test searching for a title only that doesnt exist
            if (filteredTable &&
                filteredTable instanceof Array &&
                filteredTable.length > 0) {
                const itemIdSet = new Set();
                let cursorKey = filteredTable[filteredTable.length - 1].threadIndex;
                filteredTable.map((mod) => itemIdSet.add(mod.itemId));
                const itemIds = Array.from(itemIdSet);
                const result = yield db_1.db.query.items.findMany({
                    where: (0, drizzle_orm_1.inArray)(itemsSchema_1.items.itemId, itemIds),
                    columns: { threadIndex: false },
                    with: {
                        mods: { columns: { itemId: false } },
                        catalog: { columns: { views: false } },
                    },
                    orderBy: itemsSchema_1.items.threadIndex,
                });
                const res = Array.from((0, search_1.mapItemsToShop)(result));
                return {
                    array: res,
                    cursor: cursorKey,
                };
            }
            return { array: [], cursor: null };
        }
        catch (error) {
            console.error(error);
        }
    });
}
