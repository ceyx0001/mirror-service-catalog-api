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
exports.ensureSecureDirectory = ensureSecureDirectory;
exports.writeSecureFile = writeSecureFile;
exports.cleanupOldFiles = cleanupOldFiles;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
function ensureSecureDirectory(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            try {
                yield fs_1.promises.access(dirPath);
            }
            catch (_a) {
                yield fs_1.promises.mkdir(dirPath, { mode: 0o755, recursive: true });
            }
            const stats = yield fs_1.promises.stat(dirPath);
            if (!stats.isDirectory()) {
                throw new Error("Path exists but is not a directory");
            }
            yield fs_1.promises.access(dirPath, fs_1.promises.constants.W_OK);
        }
        catch (error) {
            throw new Error(`Failed to ensure secure directory: ${error.message}`);
        }
    });
}
function writeSecureFile(filePath, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const normalizedPath = path_1.default.normalize(filePath);
            if (!normalizedPath.startsWith(path_1.default.join(__dirname, "csv"))) {
                throw new Error("Invalid file path");
            }
            yield fs_1.promises.writeFile(normalizedPath, data, {
                mode: 0o644,
                flag: "w",
            });
        }
        catch (error) {
            throw new Error(`Failed to write file securely: ${error.message}`);
        }
    });
}
function cleanupOldFiles(directory, maxAgeMs) {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield fs_1.promises.readdir(directory);
        const now = Date.now();
        yield Promise.all(files.map((file) => __awaiter(this, void 0, void 0, function* () {
            const filePath = path_1.default.join(directory, file);
            const stats = yield fs_1.promises.stat(filePath);
            if (now - stats.mtimeMs > maxAgeMs) {
                yield fs_1.promises.unlink(filePath);
            }
        })));
    });
}
