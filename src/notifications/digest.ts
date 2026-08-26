import {
  DigestEntry,
  DigestSummary,
  NotificationSeverity,
} from "./types";
import { config } from "../config";
import { createContextLogger } from "../utils/logger";

const log = createContextLogger("digest");

/**
 * Notification Digest — compresses raw agent logs, graph iterations,
 * and multi-step execution loops into succinct 2-3 bullet point
 * executive summaries.
 */
export class NotificationDigest {
  private entries: DigestEntry[] = [];
  private maxBullets: number;

  constructor(maxBullets?: number) {
    this.maxBullets = maxBullets || config.notifications.digestMaxBullets;
  }

  /**
   * Add a log entry to the digest buffer.
   */
  addEntry(entry: DigestEntry): void {
    this.entries.push(entry);
  }

  /**
   * Add multiple entries at once.
   */
  addEntries(entries: DigestEntry[]): void {
    this.entries.push(...entries);
  }

  /**
   * Generate a compressed digest summary from buffered entries.
   * Compresses N entries into maxBullets executive summary points.
   */
  generateDigest(): DigestSummary | null {
    if (this.entries.length === 0) return null;

    const sorted = [...this.entries].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const severity = this.getHighestSeverity(sorted);
    const grouped = this.groupBySource(sorted);
    const bullets = this.compressToBullets(grouped);

    const summary: DigestSummary = {
      title: this.generateTitle(sorted, severity),
      bullets: bullets.slice(0, this.maxBullets),
      severity,
      entryCount: sorted.length,
      timeRange: {
        from: sorted[0].timestamp,
        to: sorted[sorted.length - 1].timestamp,
      },
    };

    log.info("Digest generated", {
      entryCount: summary.entryCount,
      bulletCount: summary.bullets.length,
      severity: summary.severity,
    });

    return summary;
  }

  /**
   * Clear the entry buffer.
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get the number of buffered entries.
   */
  get size(): number {
    return this.entries.length;
  }

  // ─── Private Helpers ──────────────────────────────────────────

  private getHighestSeverity(entries: DigestEntry[]): NotificationSeverity {
    const order: NotificationSeverity[] = ["info", "success", "warning", "error"];
    let highest: NotificationSeverity = "info";
    for (const entry of entries) {
      if (order.indexOf(entry.severity) > order.indexOf(highest)) {
        highest = entry.severity;
      }
    }
    return highest;
  }

  private groupBySource(
    entries: DigestEntry[]
  ): Map<string, DigestEntry[]> {
    const groups = new Map<string, DigestEntry[]>();
    for (const entry of entries) {
      const existing = groups.get(entry.source) || [];
      existing.push(entry);
      groups.set(entry.source, existing);
    }
    return groups;
  }

  private compressToBullets(
    grouped: Map<string, DigestEntry[]>
  ): string[] {
    const bullets: string[] = [];

    for (const [source, entries] of grouped) {
      const errors = entries.filter((e) => e.severity === "error");
      const warnings = entries.filter((e) => e.severity === "warning");
      const successes = entries.filter((e) => e.severity === "success");

      if (errors.length > 0) {
        bullets.push(
          `❌ ${source}: ${errors.length} error(s) — ${errors[0].message.substring(0, 80)}`
        );
      } else if (warnings.length > 0) {
        bullets.push(
          `⚠️ ${source}: ${warnings.length} warning(s) — ${warnings[0].message.substring(0, 80)}`
        );
      } else if (successes.length > 0) {
        bullets.push(
          `✅ ${source}: ${successes.length} task(s) completed successfully`
        );
      } else {
        bullets.push(
          `ℹ️ ${source}: ${entries.length} update(s) processed`
        );
      }
    }

    return bullets;
  }

  private generateTitle(
    entries: DigestEntry[],
    severity: NotificationSeverity
  ): string {
    const icons: Record<NotificationSeverity, string> = {
      info: "📋",
      success: "✅",
      warning: "⚠️",
      error: "🚨",
    };

    const sources = [...new Set(entries.map((e) => e.source))];
    const sourceList =
      sources.length <= 2
        ? sources.join(" & ")
        : `${sources[0]} +${sources.length - 1} more`;

    return `${icons[severity]} V3 ADLC — ${sourceList} (${entries.length} events)`;
  }
}

/**
 * Quick utility: compress a flat array of entries into a digest.
 */
export function compressEntries(
  entries: DigestEntry[],
  maxBullets?: number
): DigestSummary | null {
  const digest = new NotificationDigest(maxBullets);
  digest.addEntries(entries);
  return digest.generateDigest();
}

export default NotificationDigest;

// ─── CLI Entry Point ──────────────────────────────────────────────

if (require.main === module) {
  const { Command } = require("commander");
  const { formatSlackMessage } = require("./slack-webhook");
  const program = new Command();
  program
    .name("notify:digest")
    .description("Generate a notification digest from recent agent activity")
    .option("--demo", "Run with demo data", false)
    .option("--json", "Output as JSON", false)
    .option("--slack", "Format as Slack Block Kit message", false)
    .action(async (opts: any) => {
      const digest = new NotificationDigest();

      if (opts.demo) {
        // Add demo entries to show the digest in action
        const now = new Date();
        digest.addEntries([
          { source: "spec-generator", severity: "success", message: "Spec generated for trading-platform v0.1.0", timestamp: new Date(now.getTime() - 300000) },
          { source: "oneshot-builder", severity: "success", message: "Build complete — 12 files generated in 4.2s", timestamp: new Date(now.getTime() - 240000) },
          { source: "bug-scanner", severity: "warning", message: "3 medium-severity issues found in src/routes/", timestamp: new Date(now.getTime() - 180000) },
          { source: "bug-fixer", severity: "success", message: "Auto-fixed 2 of 3 issues, 1 requires manual review", timestamp: new Date(now.getTime() - 120000) },
          { source: "feature-add", severity: "info", message: "Feature 'dark-mode' added to spec, rebuild triggered", timestamp: new Date(now.getTime() - 60000) },
        ]);
      } else {
        console.log("No entries to digest. Use --demo for sample output.");
        process.exit(0);
      }

      const summary = digest.generateDigest();
      if (!summary) {
        console.log("No digest generated.");
        process.exit(0);
      }

      if (opts.json) {
        console.log(JSON.stringify(summary, null, 2));
      } else if (opts.slack) {
        const slackMsg = formatSlackMessage(summary);
        console.log(JSON.stringify(slackMsg, null, 2));
      } else {
        console.log(`\n${summary.title}`);
        console.log("─".repeat(50));
        for (const bullet of summary.bullets) {
          console.log(`  ${bullet}`);
        }
        console.log("─".repeat(50));
        console.log(`  Events: ${summary.entryCount} | Severity: ${summary.severity}`);
        console.log(`  Time: ${summary.timeRange.from.toISOString()} → ${summary.timeRange.to.toISOString()}`);
      }
    });

  program.parse();
}
