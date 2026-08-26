import fs from "fs";
import { createContextLogger } from "./logger";

const log = createContextLogger("markdown");

/**
 * Extract the H1 title from a markdown string.
 */
export function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Extract a metadata value from a markdown blockquote header.
 * Looks for patterns like: > **Key:** Value
 */
export function extractMeta(markdown: string, key: string): string | null {
  const regex = new RegExp(
    `>\\s*\\*\\*${key}:?\\*\\*\\s*(.+)`,
    "i"
  );
  const match = markdown.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract all H2 section headings from markdown.
 */
export function extractSections(markdown: string): string[] {
  const matches = markdown.matchAll(/^##\s+(.+)$/gm);
  return Array.from(matches, (m) => m[1].trim());
}

/**
 * Extract a specific section's content by heading.
 */
export function extractSection(
  markdown: string,
  heading: string
): string | null {
  const regex = new RegExp(
    `^##\\s+${escapeRegex(heading)}\\s*$([\\s\\S]*?)(?=^##\\s|$)`,
    "m"
  );
  const match = markdown.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Count the number of user stories (rows in a table starting with US-).
 */
export function countUserStories(markdown: string): number {
  const matches = markdown.matchAll(/\|\s*US-\d+/g);
  return Array.from(matches).length;
}

/**
 * Count the number of API endpoints (METHOD + path patterns).
 */
export function countApiEndpoints(markdown: string): number {
  const matches = markdown.matchAll(
    /####\s+`(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/gi
  );
  return Array.from(matches).length;
}

/**
 * Check if a spec has all required sections.
 */
export function validateSections(
  markdown: string,
  requiredSections: string[]
): { valid: boolean; missing: string[] } {
  const sections = extractSections(markdown);
  const normalizedSections = sections.map((s) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  const missing: string[] = [];
  for (const required of requiredSections) {
    const normalized = required.toLowerCase().replace(/[^a-z0-9]/g, "");
    const found = normalizedSections.some(
      (s) => s.includes(normalized) || normalized.includes(s)
    );
    if (!found) {
      missing.push(required);
    }
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Read a markdown file and return its content.
 */
export function readMarkdownFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    log.error(`Failed to read markdown file: ${filePath}`, { error });
    return null;
  }
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
