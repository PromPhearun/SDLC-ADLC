/**
 * Shared types for all ADLC agents.
 */

/** Standard agent execution result */
export interface AgentResult<T = unknown> {
  success: boolean;
  data: T | null;
  errors: string[];
  warnings: string[];
  duration: number; // milliseconds
  metadata: Record<string, unknown>;
}

/** Agent execution context */
export interface AgentContext {
  /** Working directory for the agent */
  workingDir: string;
  /** Spec file path if applicable */
  specPath?: string;
  /** Additional configuration */
  config?: Record<string, unknown>;
  /** Dry run mode — don't write files */
  dryRun?: boolean;
}

/** Common agent interface all agents must implement */
export interface Agent<TInput = unknown, TOutput = unknown> {
  /** Unique agent identifier */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;
  /** Execute the agent with given input */
  execute(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>>;
}

/** Spec Generator input */
export interface SpecGeneratorInput {
  /** High-level product idea or prompt */
  prompt: string;
  /** Optional project name override */
  projectName?: string;
  /** Optional output path (defaults to specs/{projectName}/spec.md) */
  outputPath?: string;
  /** Additional context or constraints */
  constraints?: string[];
}

/** Spec Generator output */
export interface SpecGeneratorOutput {
  /** Generated spec content */
  specContent: string;
  /** Path where spec was written */
  outputPath: string;
  /** Extracted metadata */
  metadata: {
    projectName: string;
    version: string;
    userStoryCount: number;
    apiEndpointCount: number;
    sectionCount: number;
  };
}

/** Bug Scanner input */
export interface BugScannerInput {
  /** Path to scan */
  scanPath: string;
  /** Spec path for validation */
  specPath?: string;
  /** Scan types to run */
  scanTypes?: ("static" | "tests" | "logs")[];
}

/** Bug report */
export interface BugReport {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "syntax" | "type" | "logic" | "security" | "performance" | "spec-violation";
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
  specReference?: string;
}

/** Bug Scanner output */
export interface BugScannerOutput {
  bugs: BugReport[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

/** Bug Fixer input */
export interface BugFixerInput {
  /** Bug report to fix */
  bug: BugReport;
  /** Spec path for validation */
  specPath: string;
  /** Source path */
  sourcePath: string;
}

/** Bug Fixer output */
export interface BugFixerOutput {
  /** Original bug */
  bug: BugReport;
  /** Fix description */
  fixDescription: string;
  /** Files modified */
  filesModified: string[];
  /** Whether fix passed validation */
  validated: boolean;
}

/** One-Shot Builder input */
export interface OneshotBuilderInput {
  /** Path to the spec file */
  specPath: string;
  /** Output directory for the app */
  outputDir: string;
  /** Whether to refactor existing code or generate fresh */
  mode: "fresh" | "refactor";
}

/** One-Shot Builder output */
export interface OneshotBuilderOutput {
  /** Files generated/modified */
  filesGenerated: string[];
  /** Build iterations performed */
  iterations: number;
  /** Whether all tests pass */
  testsPassing: boolean;
  /** Build duration */
  duration: number;
}

/** Feature Addition input */
export interface FeatureAddInput {
  /** Path to existing spec */
  specPath: string;
  /** Feature description */
  featurePrompt: string;
  /** Whether to auto-approve spec changes */
  autoApprove?: boolean;
}

/** Pipeline stage result */
export interface PipelineStageResult {
  stage: string;
  success: boolean;
  duration: number;
  output?: unknown;
  error?: string;
}

/** Notification message */
export interface NotificationMessage {
  title: string;
  bullets: string[];
  severity: "info" | "success" | "warning" | "error";
  timestamp: Date;
  source: string;
  metadata?: Record<string, unknown>;
}
