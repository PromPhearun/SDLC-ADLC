/**
 * JSON Schema for validating spec.md files.
 * Used by the auditor and pipeline to ensure spec completeness.
 */

export const SPEC_REQUIRED_SECTIONS = [
  "Executive Summary",
  "Business Facts & Requirements",
  "API Schemas & Data Contracts",
  "Design System Constraints",
  "Acceptance Criteria & Test Specifications",
  "Technical Architecture",
] as const;

export const SPEC_OPTIONAL_SECTIONS = [
  "Deployment & Operations",
  "Open Questions & Decisions",
  "Changelog",
] as const;

export interface SpecMetadata {
  projectName: string;
  version: string;
  status: "draft" | "review" | "approved" | "deprecated";
  lastUpdated: string;
  owner: string;
}

export interface SpecValidationResult {
  valid: boolean;
  metadata: SpecMetadata | null;
  sections: {
    present: string[];
    missing: string[];
    optional: string[];
  };
  stats: {
    userStories: number;
    apiEndpoints: number;
    dataModels: number;
    testCases: number;
    businessRules: number;
  };
  coverage: {
    score: number; // 0-100
    breakdown: Record<string, number>;
  };
  errors: string[];
  warnings: string[];
}

/**
 * JSON Schema definition for spec validation (usable with Ajv).
 */
export const specJsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["metadata", "sections"],
  properties: {
    metadata: {
      type: "object",
      required: ["projectName", "version", "status"],
      properties: {
        projectName: { type: "string", minLength: 1 },
        version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
        status: {
          type: "string",
          enum: ["draft", "review", "approved", "deprecated"],
        },
        lastUpdated: { type: "string", format: "date" },
        owner: { type: "string" },
      },
      additionalProperties: false,
    },
    sections: {
      type: "object",
      required: [
        "executiveSummary",
        "businessRequirements",
        "apiSchemas",
        "designSystem",
        "acceptanceCriteria",
        "technicalArchitecture",
      ],
      properties: {
        executiveSummary: { type: "string", minLength: 10 },
        businessRequirements: {
          type: "object",
          required: ["objectives", "userStories"],
          properties: {
            objectives: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["id", "objective", "priority"],
                properties: {
                  id: { type: "string", pattern: "^OBJ-\\d+$" },
                  objective: { type: "string" },
                  priority: { type: "string", enum: ["P0", "P1", "P2"] },
                  successMetric: { type: "string" },
                },
              },
            },
            userStories: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["id", "story", "acceptanceCriteria"],
                properties: {
                  id: { type: "string", pattern: "^US-\\d+$" },
                  story: { type: "string" },
                  acceptanceCriteria: { type: "string" },
                  priority: { type: "string", enum: ["P0", "P1", "P2"] },
                },
              },
            },
          },
        },
        apiSchemas: {
          type: "object",
          required: ["dataModels", "endpoints"],
          properties: {
            dataModels: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["name", "fields"],
                properties: {
                  name: { type: "string" },
                  fields: { type: "array", minItems: 1 },
                },
              },
            },
            endpoints: {
              type: "array",
              items: {
                type: "object",
                required: ["method", "path", "description"],
                properties: {
                  method: {
                    type: "string",
                    enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
                  },
                  path: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        designSystem: {
          type: "object",
          required: ["tokens", "componentMapping"],
          properties: {
            tokens: { type: "object", minProperties: 1 },
            componentMapping: { type: "array", minItems: 1 },
          },
        },
        acceptanceCriteria: {
          type: "object",
          required: ["testCases"],
          properties: {
            testCases: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["id", "feature", "expected"],
                properties: {
                  id: { type: "string", pattern: "^TC-\\d+$" },
                  feature: { type: "string" },
                  expected: { type: "string" },
                },
              },
            },
          },
        },
        technicalArchitecture: {
          type: "object",
          required: ["techStack"],
          properties: {
            techStack: { type: "array", minItems: 1 },
          },
        },
      },
    },
  },
} as const;

/**
 * Scoring weights for spec coverage calculation.
 */
export const COVERAGE_WEIGHTS: Record<string, number> = {
  executiveSummary: 10,
  businessObjectives: 10,
  userStories: 15,
  businessRules: 5,
  dataModels: 10,
  apiEndpoints: 15,
  designTokens: 5,
  componentMapping: 5,
  testCases: 10,
  performanceReqs: 5,
  securityReqs: 5,
  techStack: 5,
} as const;

