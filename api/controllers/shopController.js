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
exports.getShops = exports.getShopData = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const getShopData = (index) => __awaiter(void 0, void 0, void 0, function* () {
    const headers = {
        headers: {
            "User-Agent": `Mirror-Catalog/1.0.0 (contact:/${process.env.DEV_EMAIL}) StrictMode`,
        },
    };
    try {
        let serviceItems = [];
        const threadUrl = `https://www.pathofexile.com/forum/view-thread/${index}`;
        const threadResponse = yield axios_1.default.get(threadUrl, headers);
        const threadDocument = (0, cheerio_1.load)(threadResponse.data);
        const scriptContent = threadDocument("script")
            .last()
            .html()
            .replace(/\s\s+|\n/g, "");
        const profileName = threadDocument("tr .post_info .posted-by .profile-link")
            .first()
            .text();
        const contentString = threadDocument(".content-container").first().text();
        let characterName = null;
        let fees = [];
        if (contentString) {
            let ign = contentString.match(/IGN:\s(\S*)/);
            if (ign) {
                characterName = ign[1];
            }
            let at = contentString.match(/@(\S*)/);
            if (at) {
                characterName = at[1];
            }
            const feesString = contentString.match(/Fee: (\S+)/g);
            if (feesString) {
                feesString.forEach((feeString) => {
                    const feeInt = parseInt(feeString.split(":")[1].trim());
                    if (Number.isNaN(feeInt)) {
                        fees.push(null);
                    }
                    else {
                        fees.push(parseInt(feeString.split(":")[1].trim()));
                    }
                });
            }
        }
        if (scriptContent.includes("DeferredItemRenderer")) {
            const arrayStartIndex = scriptContent.indexOf("new R(") + 6; // clean string
            const arrayEndIndex = scriptContent.indexOf(".run()") - 2;
            const arrayString = scriptContent.slice(arrayStartIndex, arrayEndIndex);
            serviceItems = JSON.parse(arrayString)
                .map((item) => {
                if (item[1].name !== "" &&
                    !("duplicated" in item[1]) &&
                    item[1].rarity !== "Unique" &&
                    !item[1].baseType.includes("Map")) {
                    try {
                        let itemQuality;
                        if (item[1].baseType.includes(" Jewel")) {
                        }
                        else {
                            if (item[1].properties &&
                                !item[1].baseType.includes(" Jewel")) {
                                const qualityArray = item[1].properties.find((property) => /^Quality.*/.test(property.name));
                                if (qualityArray) {
                                    itemQuality = qualityArray.values[0][0].replace(/\D/g, "");
                                }
                            }
                        }
                        return {
                            id: item[1].id,
                            fee: fees.shift() || null,
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
                        console.error(error);
                        console.error(item[1].properties);
                        console.error(index);
                    }
                }
            })
                .filter(Boolean);
        }
        return {
            profileName: profileName,
            characterName: characterName,
            threadIndex: index,
            items: serviceItems,
        };
    }
    catch (error) {
        throw new Error("Failed to fetch shop data.");
    }
});
exports.getShopData = getShopData;
exports.getShops = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const threadIndex = parseInt(req.params.threadIndex);
    if (isNaN(threadIndex) || threadIndex < 0) {
        return res.status(400).json({
            error: "Invalid thread index",
        });
    }
    const data = yield (0, exports.getShopData)(threadIndex);
    if (!data) {
        return res.status(404).json({
            error: "Shop not found",
        });
    }
    return res.json(data);
}));
