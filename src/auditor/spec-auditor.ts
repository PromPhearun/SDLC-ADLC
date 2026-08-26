import { createContextLogger } from "../utils/logger";
import { buildSpecsDirectory } from "./directory-builder";

const log = createContextLogger("spec-auditor");

/**
 * Audit report for spec coverage.
 */
export interface AuditReport {
  timestamp: string;
  summary: {
    totalProjects: number;
    withSpec: number;
    withoutSpec: number;
    validSpecs: number;
    invalidSpecs: number;
    averageCoverage: number;
  };
  flagged: FlaggedProject[];
  recommendations: string[];
}

export interface FlaggedProject {
  projectName: string;
  path: string;
  issue: "missing-spec" | "invalid-spec" | "low-coverage" | "outdated";
  details: string;
  severity: "critical" | "warning" | "info";
}

/**
 * Run a full spec coverage audit across all configured scan paths.
 */
export async function runAudit(
  scanPaths?: string[]
): Promise<AuditReport> {
  log.info("Starting spec coverage audit");

  // Build/rebuild the specs directory
  const directory = await buildSpecsDirectory(scanPaths);

  // Analyze for gaps and issues
  const flagged: FlaggedProject[] = [];
  const recommendations: string[] = [];

  // Check for invalid specs
  for (const entry of directory.entries) {
    if (!entry.isValid) {
      flagged.push({
        projectName: entry.projectName,
        path: entry.path,
        issue: "invalid-spec",
        details: entry.validationErrors.join("; "),
        severity: "warning",
      });
    }

    // Flag low coverage
    if (entry.coverageScore < 50) {
      flagged.push({
        projectName: entry.projectName,
        path: entry.path,
        issue: "low-coverage",
        details: `Coverage score: ${entry.coverageScore}/100`,
        severity: entry.coverageScore < 25 ? "critical" : "warning",
      });
    }

    // Flag outdated specs (not updated in 30+ days)
    const lastModified = new Date(entry.lastModified);
    const daysSinceUpdate =
      (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 30) {
      flagged.push({
        projectName: entry.projectName,
        path: entry.path,
        issue: "outdated",
        details: `Last updated ${Math.floor(daysSinceUpdate)} days ago`,
        severity: "info",
      });
    }
  }

  // Generate recommendations
  if (directory.invalidSpecs > 0) {
    recommendations.push(
      `${directory.invalidSpecs} spec(s) have missing required sections. Run 'npm run spec:generate' to regenerate.`
    );
  }

  const lowCoverage = directory.entries.filter((e) => e.coverageScore < 50);
  if (lowCoverage.length > 0) {
    recommendations.push(
      `${lowCoverage.length} spec(s) have coverage below 50%. Consider adding more detail to API schemas, test cases, and design tokens.`
    );
  }

  if (directory.totalSpecs === 0) {
    recommendations.push(
      "No specs found. Run 'npm run spec:generate -- --prompt=\"<description>\"' to create your first spec."
    );
  }

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalProjects: directory.totalSpecs,
      withSpec: directory.totalSpecs,
      withoutSpec: 0, // Would be populated by scanning for projects without specs
      validSpecs: directory.validSpecs,
      invalidSpecs: directory.invalidSpecs,
      averageCoverage: directory.stats.averageCoverage,
    },
    flagged,
    recommendations,
  };

  log.info("Audit complete", {
    totalProjects: report.summary.totalProjects,
    flagged: flagged.length,
    recommendations: recommendations.length,
  });

  return report;
}

/**
 * Print a formatted audit report to console.
 */
export function printAuditReport(report: AuditReport): void {
  console.log("\n" + "═".repeat(60));
  console.log("  ADLC — Spec Coverage Audit Report");
  console.log("═".repeat(60));
  console.log(`  Timestamp: ${report.timestamp}`);
  console.log("─".repeat(60));

  console.log("\n  📊 Summary:");
  console.log(`     Total Projects:    ${report.summary.totalProjects}`);
  console.log(`     Valid Specs:       ${report.summary.validSpecs}`);
  console.log(`     Invalid Specs:     ${report.summary.invalidSpecs}`);
  console.log(`     Avg Coverage:      ${report.summary.averageCoverage}%`);

  if (report.flagged.length > 0) {
    console.log("\n  🚩 Flagged Issues:");
    for (const flag of report.flagged) {
      const icon =
        flag.severity === "critical"
          ? "🔴"
          : flag.severity === "warning"
            ? "🟡"
            : "🔵";
      console.log(`     ${icon} [${flag.issue}] ${flag.projectName}`);
      console.log(`        ${flag.details}`);
    }
  } else {
    console.log("\n  ✅ No issues found!");
  }

  if (report.recommendations.length > 0) {
    console.log("\n  💡 Recommendations:");
    for (const rec of report.recommendations) {
      console.log(`     • ${rec}`);
    }
  }

  console.log("\n" + "═".repeat(60) + "\n");
}

export default runAudit;
