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
exports.getThreads = exports.getThreadsData = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const urlSelling = `https://www.pathofexile.com/forum/view-forum/standard-trading-selling`;
const urlShops = `https://www.pathofexile.com/forum/view-forum/standard-trading-shops`;
const urls = [urlSelling, urlShops];
const getThreadsData = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (startPage = 1, endPage = 50) {
    if (startPage < 1)
        throw new Error("Start page must be >= 1");
    if (endPage < startPage)
        throw new Error("End page must be >= start page");
    if (endPage - startPage > 100)
        throw new Error("Maximum page range exceeded");
    const threads = new Map();
    const promises = urls.flatMap((url) => Array.from({ length: endPage - startPage + 1 }, (_, i) => __awaiter(void 0, void 0, void 0, function* () {
        const pageUrl = `${url}/page/${i + startPage}`;
        try {
            const response = yield axios_1.default.get(pageUrl, {
                headers: {
                    "User-Agent": `Mirror-Catalog/1.0 (${process.env.DEV_EMAIL}) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3`,
                },
            });
            const document = (0, cheerio_1.load)(response.data);
            document("td.thread").each((i, elem) => {
                try {
                    const threadElem = document(elem);
                    const anchor = threadElem
                        .children(".thread_title")
                        .children(".title")
                        .children("a");
                    const shopTitle = anchor.text().trim();
                    if (shopTitle.toLowerCase().includes("mirror") &&
                        (shopTitle.toLowerCase().includes("service") ||
                            shopTitle.toLowerCase().includes("shop"))) {
                        const thread = {
                            profileName: threadElem
                                .children(".postBy")
                                .children(".post_by_account")
                                .children("a")
                                .text()
                                .trim(),
                            index: parseInt(anchor.attr("href").replace(/\D/g, "")),
                            views: parseInt(threadElem
                                .siblings(".views")
                                .children(".post-stat")
                                .children("span")
                                .text()),
                            title: shopTitle,
                        };
                        threads.set(thread.profileName, thread);
                    }
                }
                catch (error) {
                    throw new Error("Failed to fetch threads: " + error.message);
                }
            });
        }
        catch (error) {
            throw new Error("Failed to fetch threads: " + error.message);
        }
    })));
    yield Promise.all(promises);
    return Array.from(threads.values());
});
exports.getThreadsData = getThreadsData;
exports.getThreads = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const startPage = Number((_a = req.query) === null || _a === void 0 ? void 0 : _a.startPage) || 1;
    const endPage = Number((_b = req.query) === null || _b === void 0 ? void 0 : _b.endPage) || 50;
    try {
        const data = yield (0, exports.getThreadsData)(startPage, endPage);
        if (data.length === 0) {
            return res.status(404).json({
                error: "No mirror threads found",
            });
        }
        res.setHeader("Cache-Control", "public, max-age=300");
        return res.json({
            success: true,
            data,
            meta: {
                total: data.length,
                startPage,
                endPage,
            },
        });
    }
    catch (error) {
        return res.status(500).json({
            error: "Failed to fetch threads",
            message: error.message,
        });
    }
}));
