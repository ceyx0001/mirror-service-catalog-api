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
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const getShopData = (index) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // clean response into array of JSON objects
        let serviceItems = [];
        const threadUrl = `https://www.pathofexile.com/forum/view-thread/${index}`;
        const threadResponse = yield axios_1.default.get(threadUrl, {
            headers: {
                "User-Agent": `Mirror-Catalog/1.0 (${process.env.DEV_EMAIL}) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3`,
            },
        });
        const threadDocument = (0, cheerio_1.load)(threadResponse.data);
        const scriptContent = threadDocument("script")
            .last()
            .html()
            .replace(/\s\s+|\n/g, "");
        const profileName = threadDocument("tr .post_info .posted-by .profile-link")
            .first()
            .text();
        if (scriptContent.includes("DeferredItemRenderer")) {
            const arrayStartIndex = scriptContent.indexOf("new R(") + 6; // clean string
            const arrayEndIndex = scriptContent.indexOf(".run()") - 2;
            const arrayString = scriptContent.slice(arrayStartIndex, arrayEndIndex);
            serviceItems = JSON.parse(arrayString)
                .map((item) => {
                if (item[1].name !== "" &&
                    !("duplicated" in item[1]) &&
                    item[1].rarity !== "Unique" &&
                    !item[1].baseType.includes(" Jewel") &&
                    !item[1].baseType.includes("Map")) {
                    try {
                        let itemQuality;
                        if (item[1].properties) {
                            const qualityArray = item[1].properties.find((property) => /^Quality.*/.test(property.name));
                            if (qualityArray) {
                                itemQuality = qualityArray.values[0][0].replace(/\D/g, "");
                            }
                        }
                        return {
                            id: item[1].id,
                            icon: item[1].icon,
                            name: item[1].name,
                            baseType: item[1].baseType,
                            quality: itemQuality || null,
                            enchantMods: item[1].enchantMods || null,
                            implicitMods: item[1].implicitMods || null,
                            explicitMods: item[1].explicitMods || null,
                            fracturedMods: item[1].fracturedMods || null,
                            craftedMods: item[1].craftedMods || null,
                            crucibleMods: item[1].crucibleMods || null,
                        };
                    }
                    catch (error) {
                        console.log(error);
                        console.log(item[1].properties);
                        console.log(index);
                    }
                }
            })
                .filter(Boolean);
        }
        return {
            profileName: profileName,
            threadIndex: parseInt(index),
            items: serviceItems,
        };
    }
    catch (error) {
        console.log(error);
    }
});
const shop = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (res) {
        const data = yield getShopData(req.params.threadIndex);
        return res.json(data);
    }
    else {
        const data = yield getShopData(req);
        return data;
    }
}));
exports.default = shop;
