/**
 * Schema for the centralized specs-directory.json index.
 * Aggregates metadata from all discovered spec.md files.
 */

export interface SpecEntry {
  /** Absolute path to the spec.md file */
  path: string;
  /** Project name extracted from spec */
  projectName: string;
  /** Spec version */
  version: string;
  /** Spec status */
  status: "draft" | "review" | "approved" | "deprecated";
  /** Last modified timestamp */
  lastModified: string;
  /** Owner/author */
  owner: string;
  /** Coverage score (0-100) */
  coverageScore: number;
  /** Number of user stories */
  userStoryCount: number;
  /** Number of API endpoints */
  apiEndpointCount: number;
  /** Whether the spec passes validation */
  isValid: boolean;
  /** Validation errors if any */
  validationErrors: string[];
  /** Tags for categorization */
  tags: string[];
}

export interface SpecsDirectory {
  /** Schema version */
  version: string;
  /** Timestamp of last scan */
  lastScan: string;
  /** Total number of specs found */
  totalSpecs: number;
  /** Number of valid specs */
  validSpecs: number;
  /** Number of invalid specs */
  invalidSpecs: number;
  /** Coverage statistics */
  stats: {
    averageCoverage: number;
    minCoverage: number;
    maxCoverage: number;
    statusBreakdown: Record<string, number>;
  };
  /** All discovered spec entries */
  entries: SpecEntry[];
}

/**
 * JSON Schema for specs-directory.json (usable with Ajv).
 */
export const specsDirectoryJsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["version", "lastScan", "totalSpecs", "entries"],
  properties: {
    version: { type: "string" },
    lastScan: { type: "string", format: "date-time" },
    totalSpecs: { type: "integer", minimum: 0 },
    validSpecs: { type: "integer", minimum: 0 },
    invalidSpecs: { type: "integer", minimum: 0 },
    stats: {
      type: "object",
      properties: {
        averageCoverage: { type: "number", minimum: 0, maximum: 100 },
        minCoverage: { type: "number", minimum: 0, maximum: 100 },
        maxCoverage: { type: "number", minimum: 0, maximum: 100 },
        statusBreakdown: {
          type: "object",
          additionalProperties: { type: "integer" },
        },
      },
    },
    entries: {
      type: "array",
      items: {
        type: "object",
        required: [
          "path",
          "projectName",
          "version",
          "status",
          "lastModified",
          "coverageScore",
          "isValid",
        ],
        properties: {
          path: { type: "string" },
          projectName: { type: "string" },
          version: { type: "string" },
          status: {
            type: "string",
            enum: ["draft", "review", "approved", "deprecated"],
          },
          lastModified: { type: "string", format: "date-time" },
          owner: { type: "string" },
          coverageScore: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          userStoryCount: { type: "integer", minimum: 0 },
          apiEndpointCount: { type: "integer", minimum: 0 },
          isValid: { type: "boolean" },
          validationErrors: {
            type: "array",
            items: { type: "string" },
          },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

/**
 * Create an empty specs directory structure.
 */
export function createEmptyDirectory(): SpecsDirectory {
  return {
    version: "1.0.0",
    lastScan: new Date().toISOString(),
    totalSpecs: 0,
    validSpecs: 0,
    invalidSpecs: 0,
    stats: {
      averageCoverage: 0,
      minCoverage: 0,
      maxCoverage: 0,
      statusBreakdown: {},
    },
    entries: [],
  };
}
