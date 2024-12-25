import fs, { promises as fsPromises } from "fs";
import path from "path";

export async function ensureSecureDirectory(dirPath: string) {
  try {
    try {
      await fsPromises.access(dirPath);
    } catch {
      await fsPromises.mkdir(dirPath, { mode: 0o755, recursive: true });
    }

    const stats = await fsPromises.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error("Path exists but is not a directory");
    }

    await fsPromises.access(dirPath, fsPromises.constants.W_OK);
  } catch (error) {
    throw new Error(`Failed to ensure secure directory: ${error.message}`);
  }
}

export async function writeSecureFile(filePath: string, data: string) {
  try {
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(path.join(__dirname, "csv"))) {
      throw new Error("Invalid file path");
    }

    await fsPromises.writeFile(normalizedPath, data, {
      mode: 0o644,
      flag: "w",
    });
  } catch (error) {
    throw new Error(`Failed to write file securely: ${error.message}`);
  }
}

export async function cleanupOldFiles(directory: string, maxAgeMs: number) {
  const files = await fsPromises.readdir(directory);
  const now = Date.now();

  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(directory, file);
      const stats = await fsPromises.stat(filePath);
      if (now - stats.mtimeMs > maxAgeMs) {
        await fsPromises.unlink(filePath);
      }
    })
  );
}
