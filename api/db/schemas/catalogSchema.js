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
    titleSearchIndex: (0, pg_core_1.index)("titleSearchIndex").using(`gin`, (0, drizzle_orm_1.sql) `to_tsvector('simple', ${table.title})`, table.title),
    catalogViewsIndex: (0, pg_core_1.index)("catalogViewsIndex").on(table.views),
    catalogThreadIndexDesc: (0, pg_core_1.index)("catalogThreadIndexDesc").on(table.threadIndex.desc()),
}));
exports.catalogRelations = (0, drizzle_orm_1.relations)(exports.catalog, ({ many }) => ({
    items: many(itemsSchema_1.items),
}));
