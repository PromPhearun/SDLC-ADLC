import path from "path";
import { execSync } from "child_process";
import {
  Agent, AgentContext, AgentResult,
  BugScannerInput, BugScannerOutput, BugReport,
} from "./types";
import { config } from "../config";
import { readFileSafe, findFiles } from "../utils/file-io";
import { createContextLogger } from "../utils/logger";
import { generateFromPrompts } from "../services/ai-client";
import { BUG_ANALYSIS_SYSTEM, buildBugAnalysisPrompt } from "../services/prompts/bug-analysis";

const log = createContextLogger("bug-scanner");

/**
 * Bug Scanner Agent — runs static analysis, tests, and log parsing
 * to detect anomalies against the specification.
 */
export class BugScannerAgent implements Agent<BugScannerInput, BugScannerOutput> {
  readonly name = "bug-scanner";
  readonly description = "Scans codebase for bugs via static analysis, tests, and log parsing";

  async execute(
    input: BugScannerInput,
    _context: AgentContext
  ): Promise<AgentResult<BugScannerOutput>> {
    const startTime = Date.now();
    log.info("Starting bug scan", { scanPath: input.scanPath });

    const bugs: BugReport[] = [];
    const scanTypes = input.scanTypes || ["static", "tests"];

    try {
      if (scanTypes.includes("static")) bugs.push(...await this.runStaticAnalysis(input.scanPath));
      if (scanTypes.includes("tests")) bugs.push(...await this.runTestSuite(input.scanPath));
      if (scanTypes.includes("logs")) bugs.push(...await this.parseLogs(input.scanPath));
      if (input.specPath) bugs.push(...await this.validateAgainstSpec(input.scanPath, input.specPath));

      // AI-powered deep analysis
      if (config.ai.apiKey) {
        bugs.push(...await this.runAIAnalysis(input.scanPath, input.specPath));
      }

      const summary = {
        critical: bugs.filter((b) => b.severity === "critical").length,
        high: bugs.filter((b) => b.severity === "high").length,
        medium: bugs.filter((b) => b.severity === "medium").length,
        low: bugs.filter((b) => b.severity === "low").length,
        total: bugs.length,
      };

      log.info("Bug scan complete", { totalBugs: summary.total });

      return {
        success: true,
        data: { bugs, summary },
        errors: [],
        warnings: summary.critical > 0 ? [`${summary.critical} critical bugs found`] : [],
        duration: Date.now() - startTime,
        metadata: { scanTypes, scanPath: input.scanPath },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("Bug scan failed", { error: message });
      return {
        success: false, data: null,
        errors: [message], warnings: [],
        duration: Date.now() - startTime, metadata: {},
      };
    }
  }

  private async runStaticAnalysis(scanPath: string): Promise<BugReport[]> {
    const bugs: BugReport[] = [];
    try {
      execSync("./node_modules/.bin/tsc --noEmit 2>&1", { cwd: scanPath, timeout: 60000, encoding: "utf-8" });
    } catch (error) {
      const output = (error as { stdout?: string }).stdout || "";
      bugs.push(...this.parseTypeScriptErrors(output));
    }

    // Scan for code smells
    const sourceFiles = findFiles(scanPath, ".ts", 5);
    for (const file of sourceFiles) {
      const content = readFileSafe(file);
      if (!content) continue;
      const relPath = path.relative(scanPath, file);

      // TODO/FIXME markers
      for (const match of content.matchAll(/(?:TODO|FIXME|HACK|XXX):\s*(.+)/gi)) {
        bugs.push({
          id: `TODO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          severity: "low", category: "logic", file: relPath,
          message: `Unresolved marker: ${match[0].trim()}`,
          suggestion: "Address the TODO/FIXME before merging",
        });
      }

      // Console statements
      for (const match of content.matchAll(/console\.(log|debug|info)\(/g)) {
        const line = content.substring(0, match.index).split("\n").length;
        bugs.push({
          id: `CONSOLE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          severity: "low", category: "logic", file: relPath, line,
          message: "Console statement in production code",
          suggestion: "Use a structured logger instead",
        });
      }

      // Any type usage
      for (const match of content.matchAll(/:\s*any\b/g)) {
        const line = content.substring(0, match.index).split("\n").length;
        bugs.push({
          id: `ANY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          severity: "medium", category: "type", file: relPath, line,
          message: "Usage of 'any' type detected",
          suggestion: "Replace with a specific type or unknown",
        });
      }
    }
    return bugs;
  }

  private async runTestSuite(scanPath: string): Promise<BugReport[]> {
    const bugs: BugReport[] = [];
    try {
      execSync(config.bugScanner.testSuiteCommand, { cwd: scanPath, timeout: 120000, encoding: "utf-8" });
    } catch (error) {
      const output = (error as { stdout?: string }).stdout || "";
      for (const failure of (output.match(/FAIL\s+(.+)/g) || [])) {
        bugs.push({
          id: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          severity: "high", category: "logic",
          file: failure.replace("FAIL ", ""),
          message: "Test suite failure",
          suggestion: "Fix the failing test or the underlying code",
        });
      }
    }
    return bugs;
  }

  private async parseLogs(scanPath: string): Promise<BugReport[]> {
    const bugs: BugReport[] = [];
    const logDir = path.join(scanPath, config.bugScanner.logParserPath);
    for (const logFile of findFiles(logDir, ".log", 2)) {
      const content = readFileSafe(logFile);
      if (!content) continue;
      const errorCount = content.split("\n").filter(
        (l) => l.includes("ERROR") || l.includes("FATAL")
      ).length;
      if (errorCount > 0) {
        bugs.push({
          id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          severity: errorCount > 10 ? "critical" : "medium",
          category: "logic", file: path.relative(scanPath, logFile),
          message: `${errorCount} error entries found in logs`,
          suggestion: "Investigate error patterns in application logs",
        });
      }
    }
    return bugs;
  }

  private async validateAgainstSpec(scanPath: string, specPath: string): Promise<BugReport[]> {
    const bugs: BugReport[] = [];
    const specContent = readFileSafe(specPath);
    if (!specContent) return bugs;

    for (const match of specContent.matchAll(/####\s+`(GET|POST|PUT|PATCH|DELETE)\s+(.+)`/g)) {
      const method = match[1];
      const routePath = match[2];
      const sourceFiles = findFiles(scanPath, ".ts", 5);
      const hasImpl = sourceFiles.some((f) => (readFileSafe(f) || "").includes(routePath));
      if (!hasImpl) {
        bugs.push({
          id: `SPEC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          severity: "high", category: "spec-violation", file: "N/A",
          message: `Spec endpoint not implemented: ${method} ${routePath}`,
          specReference: routePath,
          suggestion: `Implement ${method} ${routePath} as defined in spec`,
        });
      }
    }
    return bugs;
  }

  private parseTypeScriptErrors(output: string): BugReport[] {
    const bugs: BugReport[] = [];
    const pattern = /^(.+)\((\d+),\d+\): error (TS\d+): (.+)$/gm;
    let match;
    while ((match = pattern.exec(output)) !== null) {
      bugs.push({
        id: `TS-${match[3]}-${Date.now()}`,
        severity: "high", category: "type",
        file: match[1], line: parseInt(match[2], 10),
        message: `${match[3]}: ${match[4]}`,
        suggestion: "Fix the TypeScript compilation error",
      });
    }
    return bugs;
  }

  /**
   * AI-powered deep code analysis.
   * Analyzes key source files for bugs, security issues, and logic errors.
   */
  private async runAIAnalysis(scanPath: string, specPath?: string): Promise<BugReport[]> {
    const bugs: BugReport[] = [];
    const sourceFiles = findFiles(scanPath, ".ts", 5).slice(0, 10); // Limit to 10 files

    let specContext: string | undefined;
    if (specPath) {
      specContext = readFileSafe(specPath)?.substring(0, 1000);
    }

    for (const file of sourceFiles) {
      const content = readFileSafe(file);
      if (!content || content.length < 50) continue;

      const relPath = path.relative(scanPath, file);

      try {
        log.info("AI analyzing file", { file: relPath });
        const prompt = buildBugAnalysisPrompt(content, relPath, specContext);
        const result = await generateFromPrompts(BUG_ANALYSIS_SYSTEM, prompt, {
          temperature: config.ai.bugFixTemperature,
          maxTokens: 2000,
        });

        // Parse AI response as JSON array
        let aiBugs: BugReport[] = [];
        try {
          let jsonContent = result.content.trim();
          if (jsonContent.startsWith("```json")) jsonContent = jsonContent.slice(7);
          if (jsonContent.startsWith("```")) jsonContent = jsonContent.slice(3);
          if (jsonContent.endsWith("```")) jsonContent = jsonContent.slice(0, -3);
          jsonContent = jsonContent.trim();

          aiBugs = JSON.parse(jsonContent);
        } catch {
          log.warn("Failed to parse AI bug analysis response", { file: relPath });
        }

        bugs.push(...aiBugs);
      } catch (error) {
        log.warn("AI analysis failed for file", {
          file: relPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return bugs;
  }
}

export default BugScannerAgent;

// ─── CLI Entry Point ──────────────────────────────────────────────

if (require.main === module) {
  const { Command } = require("commander");
  const program = new Command();
  program
    .name("bug:scan")
    .description("Scan codebase for bugs via static analysis, tests, and log parsing")
    .option("--path <dir>", "Directory to scan", ".")
    .option("--spec <path>", "Optional spec.md to validate against")
    .option("--types <types>", "Scan types: static,tests,logs (comma-separated)", "static,tests")
    .action(async (opts: any) => {
      const agent = new BugScannerAgent();
      const context = { workingDir: process.cwd(), dryRun: false };
      const scanTypes = opts.types.split(",").map((t: string) => t.trim());

      const result = await agent.execute(
        {
          scanPath: path.resolve(opts.path),
          specPath: opts.spec ? path.resolve(opts.spec) : undefined,
          scanTypes,
        },
        context
      );

      if (result.success && result.data) {
        const { bugs, summary } = result.data;
        console.log("\n🔍 Bug Scan Complete");
        console.log(`   Total: ${summary.total}`);
        console.log(`   Critical: ${summary.critical} | High: ${summary.high} | Medium: ${summary.medium} | Low: ${summary.low}`);
        if (bugs.length > 0) {
          console.log("\n   Bugs Found:");
          for (const bug of bugs.slice(0, 20)) {
            console.log(`   [${bug.severity.toUpperCase()}] ${bug.file}${bug.line ? `:${bug.line}` : ""} — ${bug.message}`);
          }
          if (bugs.length > 20) console.log(`   ... and ${bugs.length - 20} more`);
        }
        console.log(`\n   Duration: ${result.duration}ms`);
        if (summary.critical > 0) process.exit(1);
      } else {
        console.error("\n❌ Bug Scan Failed");
        console.error(`   Errors: ${result.errors.join(", ")}`);
        process.exit(1);
      }
    });

  program.parse();
}

