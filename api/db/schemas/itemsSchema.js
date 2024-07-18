"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.itemsRelations = exports.items = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const catalogSchema_1 = require("./catalogSchema");
const modsSchema_1 = require("./modsSchema");
exports.items = (0, pg_core_1.pgTable)("items", {
    itemId: (0, pg_core_1.text)("itemId").primaryKey(),
    fee: (0, pg_core_1.integer)("fee"),
    icon: (0, pg_core_1.text)("icon"),
    name: (0, pg_core_1.text)("name"),
    baseType: (0, pg_core_1.text)("baseType"),
    quality: (0, pg_core_1.text)("quality"),
    shopId: (0, pg_core_1.integer)("shopId")
        .notNull()
        .references(() => catalogSchema_1.catalog.threadIndex, { onUpdate: "cascade" }),
}, (table) => ({
    nameSearchIndex: (0, pg_core_1.index)("nameSearchIndex")
        .on(table.name)
        .using((0, drizzle_orm_1.sql) `gin(to_tsvector('english', ${table.name}))`),
    baseTypeSearchIndex: (0, pg_core_1.index)("baseTypeSearchIndex")
        .on(table.baseType)
        .using((0, drizzle_orm_1.sql) `gin(to_tsvector('english', ${table.baseType}))`),
}));
exports.itemsRelations = (0, drizzle_orm_1.relations)(exports.items, ({ one, many }) => ({
    catalog: one(catalogSchema_1.catalog, {
        fields: [exports.items.shopId],
        references: [catalogSchema_1.catalog.threadIndex],
    }),
    mods: many(modsSchema_1.mods),
}));
