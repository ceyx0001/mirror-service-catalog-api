"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRelations = exports.catalog = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const itemsSchema_1 = require("./itemsSchema");
exports.catalog = (0, pg_core_1.pgTable)("catalog", {
    profileName: (0, pg_core_1.text)("profileName").notNull().primaryKey(),
    threadIndex: (0, pg_core_1.integer)("threadIndex").unique(),
    views: (0, pg_core_1.integer)("views"),
    title: (0, pg_core_1.text)("title"),
});
exports.catalogRelations = (0, drizzle_orm_1.relations)(exports.catalog, ({ many }) => ({
    items: many(itemsSchema_1.items),
}));