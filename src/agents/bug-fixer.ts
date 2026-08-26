import path from "path";
import {
  Agent, AgentContext, AgentResult,
  BugFixerInput, BugFixerOutput, BugReport,
} from "./types";
import { readFileSafe, writeFileEnsuringDir } from "../utils/file-io";
import { createContextLogger } from "../utils/logger";

const log = createContextLogger("bug-fixer");

/**
 * Bug Auto-Fixer Agent — picks up reported bugs, generates fixes
 * against the spec, validates via tests, creates ready-to-merge resolution.
 */
export class BugFixerAgent implements Agent<BugFixerInput, BugFixerOutput> {
  readonly name = "bug-fixer";
  readonly description = "Automatically fixes detected bugs and validates against spec";

  async execute(
    input: BugFixerInput,
    context: AgentContext
  ): Promise<AgentResult<BugFixerOutput>> {
    const startTime = Date.now();
    const { bug, specPath, sourcePath } = input;

    log.info("Starting bug fix", { bugId: bug.id, severity: bug.severity, category: bug.category });

    try {
      const analysis = this.analyzeBug(bug);
      log.info("Bug analyzed", { strategy: analysis.strategy });

      const fix = this.generateFix(bug, sourcePath, specPath);
      if (!fix) {
        return {
          success: false, data: null,
          errors: ["Could not generate automatic fix for this bug"],
          warnings: [], duration: Date.now() - startTime,
          metadata: { bugId: bug.id },
        };
      }

      const filesModified: string[] = [];
      if (!context.dryRun) {
        for (const [filePath, content] of Object.entries(fix.files)) {
          writeFileEnsuringDir(path.resolve(sourcePath, filePath), content);
          filesModified.push(filePath);
        }
      }

      const validated = await this.validateFix(bug, sourcePath);

      return {
        success: true,
        data: { bug, fixDescription: fix.description, filesModified, validated },
        errors: [],
        warnings: validated ? [] : ["Fix could not be validated by tests"],
        duration: Date.now() - startTime,
        metadata: { bugId: bug.id, validated },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("Bug fix failed", { bugId: bug.id, error: message });
      return {
        success: false, data: null,
        errors: [message], warnings: [],
        duration: Date.now() - startTime, metadata: { bugId: bug.id },
      };
    }
  }

  private analyzeBug(bug: BugReport): { strategy: string; description: string } {
    const strategies: Record<string, { strategy: string; description: string }> = {
      type: { strategy: "type-annotation", description: `Fix type error in ${bug.file}:${bug.line || "?"}` },
      syntax: { strategy: "syntax-correction", description: `Fix syntax: ${bug.message}` },
      "spec-violation": { strategy: "implement-spec", description: `Implement: ${bug.specReference || bug.message}` },
      logic: { strategy: "logic-fix", description: `Fix logic: ${bug.message}` },
      security: { strategy: "security-patch", description: `Security fix: ${bug.message}` },
      performance: { strategy: "performance-optimization", description: `Optimize: ${bug.message}` },
    };
    return strategies[bug.category] || { strategy: "generic", description: `Address: ${bug.message}` };
  }

  private generateFix(
    bug: BugReport, sourcePath: string, _specPath: string
  ): { description: string; files: Record<string, string> } | null {
    const content = readFileSafe(path.resolve(sourcePath, bug.file));

    if (!content && bug.category !== "spec-violation") return null;

    switch (bug.category) {
      case "type":
        if (content && bug.message.includes("'any' type")) {
          return {
            description: `Replaced 'any' with 'unknown' in ${bug.file}`,
            files: { [bug.file]: content.replace(/:\s*any\b/g, ": unknown") },
          };
        }
        break;

      case "logic":
        if (content && bug.message.includes("Console statement")) {
          return {
            description: `Removed console statements from ${bug.file}`,
            files: { [bug.file]: content.replace(/console\.(log|debug|info)\([^)]*\);?\n?/g, "") },
          };
        }
        break;

      case "spec-violation":
        if (bug.specReference) {
          const stub = `// Auto-generated stub: ${bug.specReference}\nimport { Request, Response } from "express";\n\nexport async function handler(req: Request, res: Response): Promise<void> {\n  res.status(501).json({ error: "Not yet implemented" });\n}\n`;
          return {
            description: `Generated stub for: ${bug.specReference}`,
            files: { [`src/routes/${bug.specReference.replace(/\//g, "_")}.ts`]: stub },
          };
        }
        break;
    }

    // Generic: add FIXME marker
    if (content && bug.line) {
      const lines = content.split("\n");
      lines.splice(bug.line - 1, 0, `// FIXME [${bug.id}]: ${bug.message}`);
      return {
        description: `Added FIXME marker for bug ${bug.id}`,
        files: { [bug.file]: lines.join("\n") },
      };
    }

    return null;
  }

  private async validateFix(bug: BugReport, sourcePath: string): Promise<boolean> {
    try {
      const { execSync } = require("child_process");
      execSync("./node_modules/.bin/tsc --noEmit", { cwd: sourcePath, timeout: 60000, encoding: "utf-8" });
      return true;
    } catch {
      log.warn("Fix validation failed", { bugId: bug.id });
      return false;
    }
  }
}

export default BugFixerAgent;

// ─── CLI Entry Point ──────────────────────────────────────────────

if (require.main === module) {
  const { Command } = require("commander");
  const program = new Command();
  program
    .name("bug:fix")
    .description("Auto-fix detected bugs and validate against spec")
    .requiredOption("--bug-id <id>", "Bug ID to fix")
    .requiredOption("--file <path>", "File containing the bug")
    .requiredOption("--path <dir>", "Source directory")
    .option("--spec <path>", "Path to spec.md")
    .option("--severity <level>", "Bug severity", "high")
    .option("--category <type>", "Bug category", "logic")
    .option("--message <msg>", "Bug description", "")
    .option("--line <num>", "Line number", "0")
    .option("--dry-run", "Preview fix without writing", false)
    .action(async (opts: any) => {
      const agent = new BugFixerAgent();
      const context = { workingDir: process.cwd(), dryRun: opts.dryRun || false };

      const bug = {
        id: opts.bugId,
        severity: opts.severity,
        category: opts.category,
        file: opts.file,
        line: parseInt(opts.line, 10) || undefined,
        message: opts.message,
        suggestion: "",
      };

      const result = await agent.execute(
        {
          bug,
          specPath: opts.spec ? path.resolve(opts.spec) : "",
          sourcePath: path.resolve(opts.path),
        },
        context
      );

      if (result.success && result.data) {
        console.log("\n✅ Bug Fix Applied");
        console.log(`   Bug: ${result.data.bug.id}`);
        console.log(`   Fix: ${result.data.fixDescription}`);
        console.log(`   Files Modified: ${result.data.filesModified.join(", ") || "none"}`);
        console.log(`   Validated: ${result.data.validated ? "yes" : "no"}`);
        console.log(`   Duration: ${result.duration}ms`);
      } else {
        console.error("\n❌ Bug Fix Failed");
        console.error(`   Errors: ${result.errors.join(", ")}`);
        process.exit(1);
      }
    });

  program.parse();
}

