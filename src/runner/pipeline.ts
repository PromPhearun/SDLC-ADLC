import { createContextLogger } from "../utils/logger";
import { PipelineStageResult } from "../agents/types";

const log = createContextLogger("pipeline");

/**
 * Pipeline stage function type.
 * Takes input, returns output (or throws on failure).
 */
export type PipelineStageFn<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: PipelineContext
) => Promise<TOutput>;

/**
 * Context passed through all pipeline stages.
 */
export interface PipelineContext {
  /** Working directory */
  workingDir: string;
  /** Spec file path */
  specPath: string;
  /** Output directory */
  outputDir: string;
  /** Pipeline configuration */
  config: Record<string, unknown>;
  /** Accumulated results from previous stages */
  results: Map<string, unknown>;
  /** Whether to run in dry-run mode */
  dryRun: boolean;
}

/**
 * A named pipeline stage.
 */
export interface PipelineStage<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  execute: PipelineStageFn<TInput, TOutput>;
  /** If true, pipeline continues even if this stage fails */
  optional?: boolean;
}

/**
 * Pipeline execution result.
 */
export interface PipelineResult {
  success: boolean;
  stages: PipelineStageResult[];
  totalDuration: number;
  failedStage?: string;
  errors: string[];
}

/**
 * Execute a sequence of pipeline stages.
 * Each stage receives the output of the previous stage as input.
 */
export async function executePipeline(
  stages: PipelineStage<any, any>[],
  initialInput: unknown,
  context: PipelineContext
): Promise<PipelineResult> {
  const results: PipelineStageResult[] = [];
  const errors: string[] = [];
  let currentInput: unknown = initialInput;
  const pipelineStart = Date.now();

  log.info(`Starting pipeline with ${stages.length} stages`, {
    stages: stages.map((s) => s.name),
  });

  for (const stage of stages) {
    const stageStart = Date.now();
    log.info(`Executing stage: ${stage.name}`, { description: stage.description });

    try {
      const output = await stage.execute(currentInput, context);
      const duration = Date.now() - stageStart;

      results.push({
        stage: stage.name,
        success: true,
        duration,
        output,
      });

      context.results.set(stage.name, output);
      currentInput = output;

      log.info(`Stage ${stage.name} completed`, { duration: `${duration}ms` });
    } catch (error) {
      const duration = Date.now() - stageStart;
      const message = error instanceof Error ? error.message : String(error);

      results.push({
        stage: stage.name,
        success: false,
        duration,
        error: message,
      });

      if (stage.optional) {
        log.warn(`Optional stage ${stage.name} failed, continuing`, {
          error: message,
        });
      } else {
        log.error(`Stage ${stage.name} failed`, { error: message });
        errors.push(`[${stage.name}] ${message}`);

        return {
          success: false,
          stages: results,
          totalDuration: Date.now() - pipelineStart,
          failedStage: stage.name,
          errors,
        };
      }
    }
  }

  const totalDuration = Date.now() - pipelineStart;
  log.info("Pipeline completed", {
    success: true,
    totalDuration: `${totalDuration}ms`,
    stagesCompleted: results.length,
  });

  return {
    success: true,
    stages: results,
    totalDuration,
    errors,
  };
}

/**
 * Create a pipeline stage from a function.
 */
export function createStage<TInput, TOutput>(
  name: string,
  description: string,
  fn: PipelineStageFn<TInput, TOutput>,
  optional = false
): PipelineStage<TInput, TOutput> {
  return { name, description, execute: fn, optional };
}
