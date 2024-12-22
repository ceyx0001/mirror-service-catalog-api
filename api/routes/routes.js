"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const catalog = __importStar(require("../controllers/catalogController"));
const threadsController_1 = require("../controllers/threadsController");
const shopController_1 = require("../controllers/shopController");
const express_validator_1 = require("express-validator");
const router = express_1.default.Router();
const validateAndSanitizeQueries = [
    (0, express_validator_1.query)("base")
        .optional()
        .isString()
        .withMessage("Base query must be a string")
        .trim()
        .escape()
        .matches(/^[a-zA-Z0-9 ]*$/)
        .withMessage("Base query must only contain letters, numbers, and spaces"),
    (0, express_validator_1.query)("mod")
        .optional()
        .isString()
        .withMessage("Mod query must be a string")
        .trim()
        .escape()
        .matches(/^[a-zA-Z0-9 ]*$/)
        .withMessage("Mod query must only contain letters, numbers, and spaces"),
    (0, express_validator_1.query)("title")
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
router.get("/topthreads", threadsController_1.getThreads);
router.get("/threads/range", catalog.threadsInRange);
router.get("/shops/range", catalog.shopsInRange);
router.get("/shop/:threadIndex", shopController_1.getShops);
router.get("/items/filter", validateAndSanitizeQueries, (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    catalog.filteredItems(req, res);
});
router.get("/", (req, res) => {
    res.redirect("/shops/range");
});
router.get("/forumthreads", threadsController_1.getThreads);
exports.default = router;
