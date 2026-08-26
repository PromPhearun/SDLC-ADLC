import path from "path";
import fs from "fs";
import { createContextLogger } from "../utils/logger";
import { readFileSafe, writeJson, findFiles } from "../utils/file-io";
import {
  extractTitle,
  extractMeta,
  countUserStories,
  countApiEndpoints,
  validateSections,
} from "../utils/markdown";
import {
  SPEC_REQUIRED_SECTIONS,
  COVERAGE_WEIGHTS,
} from "../schemas/spec.schema";
import {
  SpecEntry,
  SpecsDirectory,
  createEmptyDirectory,
} from "../schemas/spec-directory.schema";
import { config } from "../config";

const log = createContextLogger("directory-builder");

/**
 * Scan all configured paths for spec.md files and build
 * a centralized specs-directory.json index.
 */
export async function buildSpecsDirectory(
  scanPaths?: string[]
): Promise<SpecsDirectory> {
  const paths = scanPaths || config.scanner.scanPaths;
  log.info("Building specs directory", { scanPaths: paths });

  const directory = createEmptyDirectory();
  const allEntries: SpecEntry[] = [];

  for (const scanPath of paths) {
    const resolvedPath = path.resolve(scanPath);
    if (!fs.existsSync(resolvedPath)) {
      log.warn("Scan path does not exist", { path: resolvedPath });
      continue;
    }

    const specFiles = findFiles(resolvedPath, config.scanner.specFileName);
    log.info("Found spec files", { count: specFiles.length, path: resolvedPath });

    for (const specFile of specFiles) {
      const entry = await analyzeSpecFile(specFile);
      if (entry) allEntries.push(entry);
    }
  }

  // Calculate directory statistics
  directory.entries = allEntries;
  directory.totalSpecs = allEntries.length;
  directory.validSpecs = allEntries.filter((e) => e.isValid).length;
  directory.invalidSpecs = directory.totalSpecs - directory.validSpecs;
  directory.lastScan = new Date().toISOString();

  if (allEntries.length > 0) {
    const scores = allEntries.map((e) => e.coverageScore);
    directory.stats = {
      averageCoverage: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      minCoverage: Math.min(...scores),
      maxCoverage: Math.max(...scores),
      statusBreakdown: allEntries.reduce((acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // Write the directory file
  const outputPath = config.paths.specsDirectory;
  writeJson(outputPath, directory);
  log.info("Specs directory written", { path: outputPath, totalSpecs: directory.totalSpecs });

  return directory;
}

/**
 * Analyze a single spec.md file and produce a SpecEntry.
 */
async function analyzeSpecFile(filePath: string): Promise<SpecEntry | null> {
  const content = readFileSafe(filePath);
  if (!content) return null;

  const projectName = extractTitle(content) || path.basename(path.dirname(filePath));
  const version = extractMeta(content, "Version") || "unknown";
  const status = (extractMeta(content, "Status") || "draft") as SpecEntry["status"];
  const owner = extractMeta(content, "Owner") || "unknown";
  const validation = validateSections(content, [...SPEC_REQUIRED_SECTIONS]);
  const userStoryCount = countUserStories(content);
  const apiEndpointCount = countApiEndpoints(content);
  const coverageScore = calculateCoverageScore(content);
  const stats = fs.statSync(filePath);

  return {
    path: filePath,
    projectName,
    version,
    status,
    lastModified: stats.mtime.toISOString(),
    owner,
    coverageScore,
    userStoryCount,
    apiEndpointCount,
    isValid: validation.valid,
    validationErrors: validation.missing.map((m) => `Missing section: ${m}`),
    tags: [],
  };
}

/**
 * Calculate a coverage score (0-100) based on spec completeness.
 */
function calculateCoverageScore(content: string): number {
  let score = 0;

  if (content.includes("## 1. Executive Summary")) score += COVERAGE_WEIGHTS.executiveSummary || 10;
  if (content.match(/\|\s*OBJ-\d+/)) score += COVERAGE_WEIGHTS.businessObjectives || 10;

  const userStories = countUserStories(content);
  if (userStories > 0) score += Math.min(COVERAGE_WEIGHTS.userStories || 15, userStories * 3);

  if (content.match(/\|\s*BR-\d+/)) score += COVERAGE_WEIGHTS.businessRules || 5;
  if (content.includes("interface ") || content.includes("type ")) score += COVERAGE_WEIGHTS.dataModels || 10;

  const endpoints = countApiEndpoints(content);
  if (endpoints > 0) score += Math.min(COVERAGE_WEIGHTS.apiEndpoints || 15, endpoints * 5);

  if (content.includes("--color-") || content.includes("Design Token")) score += COVERAGE_WEIGHTS.designTokens || 5;
  if (content.includes("Component Mapping")) score += COVERAGE_WEIGHTS.componentMapping || 5;
  if (content.match(/\|\s*TC-\d+/)) score += COVERAGE_WEIGHTS.testCases || 10;
  if (content.includes("Performance") || content.includes("P95")) score += COVERAGE_WEIGHTS.performanceReqs || 5;
  if (content.includes("Security") || content.includes("Authentication")) score += COVERAGE_WEIGHTS.securityReqs || 5;
  if (content.includes("Tech Stack") || content.includes("Technology")) score += COVERAGE_WEIGHTS.techStack || 5;

  return Math.min(100, score);
}

export default buildSpecsDirectory;

