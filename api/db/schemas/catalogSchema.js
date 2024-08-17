"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRelations = exports.catalog = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const itemsSchema_1 = require("./itemsSchema");
exports.catalog = (0, pg_core_1.pgTable)("catalog", {
    profileName: (0, pg_core_1.text)("profileName").primaryKey(),
    characterName: (0, pg_core_1.text)("characterName"),
    threadIndex: (0, pg_core_1.integer)("threadIndex").unique(),
    views: (0, pg_core_1.integer)("views"),
    title: (0, pg_core_1.text)("title"),
}, (table) => ({
    titleSearchIndex: (0, pg_core_1.index)("titleSearchIndex")
        .on(table.title)
        .using((0, drizzle_orm_1.sql) `gin(to_tsvector('simple', ${table.title}))`),
    viewsIndex: (0, pg_core_1.index)("viewsIndex").on(table.views).desc(),
    threadDescIndex: (0, pg_core_1.index)("threadDescIndex").on(table.threadIndex).asc(),
}));
exports.catalogRelations = (0, drizzle_orm_1.relations)(exports.catalog, ({ many }) => ({
    items: many(itemsSchema_1.items),
}));
