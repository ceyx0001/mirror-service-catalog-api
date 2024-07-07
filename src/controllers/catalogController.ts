import { getShopData } from "./shopController";
import { getThreadsData, Thread } from "./threadsController";
import * as db from "../db/queries";
import asyncHandler from "express-async-handler";
import { Request, Response, NextFunction } from "express";

export const catalogUpdate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const tft: Thread = {
      profileName: "JeNebu",
      index: 2516760,
      views: 0,
      title:
        "🔥 The Forbidden Trove's Mirror Shop 🔥 Our Site ForbiddenTrove.com - 한국어 번역이 추가되었습니다 + 패스 오브 빌딩 링크 🔥",
    };
    try {
      const startPage = parseInt(req.query.startPage, 10) || 1;
      const endPage = parseInt(req.query.endPage, 10) || 50;
      const serviceThreads = await getThreadsData(startPage, endPage);
      serviceThreads.push(tft);
      const requests = serviceThreads.map(async (thread) => {
        const shopData = await getShopData(thread.index);
        return { ...shopData, views: thread.views, title: thread.title };
      });

      const shops = await Promise.all(requests);

      const uniqueShops = new Map();
      shops.map((shop) => {
        if (!uniqueShops.has(shop.profileName)) {
          uniqueShops.set(shop.profileName, shop);
        }
      });
      const results = Array.from(uniqueShops.values());

      if (results.length === 0) {
        const err: any = new Error("No mirror items up for service.");
        err.status(400);
        next(err);
      }
      await db.updateCatalog(results);
      res.json("complete");
    } catch (error) {
      console.log(error);
    }
  }
);

export const allThreads = asyncHandler(async (req: Request, res: Response) => {
  res.json(await db.getAllThreads());
});

export const threadsInRange = asyncHandler(
  async (req: Request, res: Response) => {
    const offset = req.query.offset - 1 || 0;
    const limit = req.query.limit || 1;
    res.json(await db.getThreadsInRange(offset, limit));
  }
);

export const shopsInRange = asyncHandler(
  async (req: Request, res: Response) => {
    const offset = req.query.offset - 1 || 0;
    const limit = req.query.limit || 1;
    res.json(await db.getShopsInRange(offset, limit));
  }
);

export const filteredItems = asyncHandler(
  async (req: Request, res: Response) => {
    const filters = {
      titleFilters:
        req.query.title !== undefined
          ? Array.isArray(req.query.title)
            ? req.query.title
            : [req.query.title]
          : undefined,
      modFilters:
        req.query.mod !== undefined
          ? Array.isArray(req.query.mod)
            ? req.query.mod
            : [req.query.mod]
          : undefined,
      baseFilters:
        req.query.base !== undefined
          ? Array.isArray(req.query.base)
            ? req.query.base
            : [req.query.base]
          : undefined,
    };
    res.json(await db.getFilteredItems(filters));
  }
);
