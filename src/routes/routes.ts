import express from "express";
import * as catalog from "../controllers/catalogController";
import { getThreads } from "../controllers/threadsController";
import { getShops } from "../controllers/shopController";
import { query, validationResult } from "express-validator";

const router = express.Router();

const validateAndSanitizeQueries = [
  query("base")
    .optional()
    .isString()
    .withMessage("Base query must be a string")
    .trim()
    .escape()
    .matches(/^[a-zA-Z0-9 ]*$/)
    .withMessage("Base query must only contain letters, numbers, and spaces"),
  query("mod")
    .optional()
    .isString()
    .withMessage("Mod query must be a string")
    .trim()
    .escape()
    .matches(/^[a-zA-Z0-9 ]*$/)
    .withMessage("Mod query must only contain letters, numbers, and spaces"),
  query("title")
    .optional()
    .isString()
    .withMessage("Title query must be a string")
    .trim()
    .escape()
    .matches(/^[a-zA-Z0-9 ]*$/)
    .withMessage("Title query must only contain letters, numbers, and spaces"),
];

router.get("/catalog-update", catalog.catalogUpdate);
router.get("/allthreads", catalog.allThreads);
router.get("/topthreads", getThreads);
router.get("/threads/range", catalog.threadsInRange);
router.get("/shops/range", catalog.shopsInRange);
router.get("/shop/:threadIndex", getShops);
router.get("/items/filter", validateAndSanitizeQueries, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  catalog.filteredItems(req, res);
});
router.get("/", (req, res) => {
  res.redirect("/shops/range");
});
router.get("/forumthreads", getThreads);

export default router;
