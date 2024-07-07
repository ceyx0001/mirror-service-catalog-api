import express from "express";
import * as catalog from "../controllers/catalogController";
import { getThreads } from "../controllers/threadsController";
import { getShops } from "../controllers/shopController";

const router = express.Router();

router.get("/catalog-update", catalog.catalogUpdate);
router.get("/allthreads", catalog.allThreads);
router.get("/topthreads", getThreads);
router.get("/threads/range", catalog.threadsInRange);
router.get("/shops/range", catalog.shopsInRange);
router.get("/shop/:threadIndex", getShops);
router.get("/items/filter", catalog.filteredItems);
router.get("/", (req, res) => {
  res.redirect("/shops/range");
});
router.get("/forumthreads", getThreads);

export default router;
