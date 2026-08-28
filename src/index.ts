/**
 * ADLC Engine — root entry point.
 *
 * Exposes the Express app, centralized configuration, and core agents for
 * programmatic use. CLI entry points live in their respective modules
 * (src/agents/*, src/runner/*, src/auditor/cli.ts, src/notifications/digest.ts).
 */

import { startServer } from "./server/index";

export { default as app } from "./server/index";
export { startServer } from "./server/index";
export { config, type Config } from "./config";
export { SpecGeneratorAgent } from "./agents/spec-generator";
export { CodeGeneratorAgent } from "./agents/code-generator";
export { BugScannerAgent } from "./agents/bug-scanner";
export { BugFixerAgent } from "./agents/bug-fixer";
export {
  executePipeline,
  createStage,
  type PipelineContext,
  type PipelineStage,
  type PipelineResult,
} from "./runner/pipeline";
export * from "./services/ai-types";

// Boot the API server when this entry point is executed directly
// (e.g. `node dist/index.js` or `ts-node src/index.ts`). Importing the
// package programmatically must NOT start listening.
if (require.main === module) {
  startServer();
}