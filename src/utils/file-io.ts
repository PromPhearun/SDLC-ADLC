import fs from "fs";
import path from "path";
import { createContextLogger } from "./logger";

const log = createContextLogger("file-io");

/**
 * Safely read a file, returning null if it doesn't exist.
 */
export function readFileSafe(filePath: string): string | null {
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return null;
    }
    return fs.readFileSync(resolved, "utf-8");
  } catch (error) {
    log.error(`Failed to read file: ${filePath}`, { error });
    return null;
  }
}

/**
 * Write a file, creating parent directories if needed.
 */
export function writeFileEnsuringDir(
  filePath: string,
  content: string
): boolean {
  try {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, content, "utf-8");
    return true;
  } catch (error) {
    log.error(`Failed to write file: ${filePath}`, { error });
    return false;
  }
}

/**
 * Read and parse a JSON file safely.
 */
export function readJsonSafe<T>(filePath: string): T | null {
  const content = readFileSafe(filePath);
  if (content === null) return null;
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    log.error(`Failed to parse JSON: ${filePath}`, { error });
    return null;
  }
}

/**
 * Write an object as formatted JSON.
 */
export function writeJson(
  filePath: string,
  data: unknown,
  pretty = true
): boolean {
  const content = pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  return writeFileEnsuringDir(filePath, content);
}

/**
 * Recursively find files matching a pattern.
 */
export function findFiles(
  rootDir: string,
  fileName: string,
  maxDepth = 10
): string[] {
  const results: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (
          entry.isDirectory() &&
          !entry.name.startsWith(".") &&
          entry.name !== "node_modules" &&
          entry.name !== "dist"
        ) {
          walk(fullPath, depth + 1);
        } else if (entry.isFile() && entry.name === fileName) {
          results.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(rootDir, 0);
  return results;
}

/**
 * Check if a path exists and is a file.
 */
export function isFile(filePath: string): boolean {
  try {
    return fs.statSync(path.resolve(filePath)).isFile();
  } catch {
    return false;
  }
}

/**
 * Check if a path exists and is a directory.
 */
export function isDirectory(dirPath: string): boolean {
  try {
    return fs.statSync(path.resolve(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check whether a resolved path is inside (or equal to) the given root
 * directory. Used to keep API-supplied paths contained within the project.
 */
export function isPathWithinRoot(targetPath: string, rootDir: string): boolean {
  const target = path.resolve(targetPath);
  const root = path.resolve(rootDir);
  return target === root || target.startsWith(root + path.sep);
}
