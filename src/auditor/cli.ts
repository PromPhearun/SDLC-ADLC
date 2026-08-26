import { Command } from "commander";
import { runAudit, printAuditReport } from "./spec-auditor";
import { createContextLogger } from "../utils/logger";

const log = createContextLogger("audit-cli");

const program = new Command();
program
  .name("audit:specs")
  .description("Scan all projects for spec coverage and flag issues")
  .option(
    "--paths <paths>",
    "Comma-separated scan paths (overrides config)",
    ""
  )
  .option("--json", "Output report as JSON", false)
  .option("--quiet", "Suppress console output", false)
  .action(async (opts) => {
    const scanPaths = opts.paths
      ? opts.paths.split(",").map((p: string) => p.trim())
      : undefined;

    log.info("Starting audit CLI", { scanPaths });

    try {
      const report = await runAudit(scanPaths);

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else if (!opts.quiet) {
        printAuditReport(report);
      }

      // Exit with error code if critical issues found
      const criticalCount = report.flagged.filter(
        (f) => f.severity === "critical"
      ).length;
      if (criticalCount > 0) {
        log.warn(`${criticalCount} critical issues found`);
        process.exit(1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("Audit failed", { error: message });
      console.error(`\n❌ Audit failed: ${message}`);
      process.exit(2);
    }
  });

program.parse();
