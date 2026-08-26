import path from "path";

/**
 * Centralized configuration for the V3 SDLC/ADLC Engine.
 * All paths are resolved relative to the project root.
 */

const ROOT_DIR = path.resolve(__dirname, "../..");

export const config = {
  // ─── Paths ───
  paths: {
    root: ROOT_DIR,
    specs: path.join(ROOT_DIR, "specs"),
    templates: path.join(ROOT_DIR, "templates"),
    specTemplate: path.join(ROOT_DIR, "templates", "spec.template.md"),
    specsDirectory: path.join(ROOT_DIR, "specs", "specs-directory.json"),
    dist: path.join(ROOT_DIR, "dist"),
    logs: path.join(ROOT_DIR, "logs"),
  },

  // ─── Spec Scanner ───
  scanner: {
    scanPaths: (process.env.SPECS_SCAN_PATHS || "./specs")
      .split(",")
      .map((p) => p.trim()),
    specFileName: "spec.md",
    directoryFileName: "specs-directory.json",
  },

  // ─── One-Shot Builder ───
  builder: {
    maxIterations: parseInt(process.env.MAX_BUILD_ITERATIONS || "5", 10),
    timeoutMs: parseInt(process.env.BUILD_TIMEOUT_MS || "300000", 10),
    parallelAgents: parseInt(process.env.PARALLEL_AGENTS || "3", 10),
  },

  // ─── Bug Scanner ───
  bugScanner: {
    staticAnalysisEnabled:
      process.env.STATIC_ANALYSIS_ENABLED !== "false",
    testSuiteCommand: process.env.TEST_SUITE_COMMAND || "npm test",
    logParserPath: process.env.LOG_PARSER_PATH || "./logs",
  },

  // ─── AI Agent ───
  ai: {
    provider: process.env.AI_PROVIDER || "openai",
    model: process.env.AI_MODEL || "gpt-4o",
    apiKey: process.env.AI_API_KEY || "",
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || "128000", 10),
  },

  // ─── Notifications ───
  notifications: {
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || "",
    slackChannel: process.env.SLACK_CHANNEL || "#v3-builds",
    digestMaxBullets: parseInt(process.env.DIGEST_MAX_BULLETS || "3", 10),
    compressionRatio: parseFloat(
      process.env.DIGEST_COMPRESSION_RATIO || "0.1"
    ),
  },

  // ─── Feature Flags ───
  features: {
    autoFix: process.env.FEATURE_AUTO_FIX !== "false",
    specValidation: process.env.FEATURE_SPEC_VALIDATION !== "false",
    notifications: process.env.FEATURE_NOTIFICATIONS !== "false",
  },
} as const;

export type Config = typeof config;
export default config;
