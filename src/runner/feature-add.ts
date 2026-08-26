import path from "path";
import { Command } from "commander";
import { createContextLogger } from "../utils/logger";
import { readFileSafe, writeFileEnsuringDir } from "../utils/file-io";
import { extractTitle, extractMeta, validateSections } from "../utils/markdown";
import { SPEC_REQUIRED_SECTIONS } from "../schemas/spec.schema";
import { runOneshotBuild } from "./oneshot-builder";
import { FeatureAddInput } from "../agents/types";

const log = createContextLogger("feature-add");

/**
 * Feature Addition Loop
 *
 * 1. Read existing spec
 * 2. Update spec with new feature requirements
 * 3. Validate updated spec
 * 4. Trigger One-Shot rebuild
 */
export async function runFeatureAdd(input: FeatureAddInput): Promise<void> {
  const startTime = Date.now();
  log.info("Starting Feature Addition Loop", {
    specPath: input.specPath,
    prompt: input.featurePrompt.substring(0, 100),
  });

  // Step 1: Read and validate existing spec
  const existingSpec = readFileSafe(input.specPath);
  if (!existingSpec) throw new Error(`Spec file not found: ${input.specPath}`);

  const validation = validateSections(existingSpec, [...SPEC_REQUIRED_SECTIONS]);
  if (!validation.valid) {
    log.warn("Existing spec has missing sections", { missing: validation.missing });
  }

  const projectName = extractTitle(existingSpec) || "Unknown Project";
  const currentVersion = extractMeta(existingSpec, "Version") || "0.0.0";
  log.info("Current spec loaded", { projectName, version: currentVersion });

  // Step 2: Update spec with new feature
  const updatedSpec = updateSpecWithFeature(existingSpec, input.featurePrompt, currentVersion);

  // Step 3: Validate updated spec
  const updatedValidation = validateSections(updatedSpec, [...SPEC_REQUIRED_SECTIONS]);
  if (!updatedValidation.valid) {
    throw new Error(`Updated spec invalid. Missing: ${updatedValidation.missing.join(", ")}`);
  }

  // Step 4: Write updated spec
  if (!input.autoApprove) {
    const newVersion = incrementVersion(currentVersion);
    console.log("\n📝 Spec Updated Successfully");
    console.log(`   Project: ${projectName}`);
    console.log(`   Version: ${currentVersion} → ${newVersion}`);
    console.log(`   Feature: ${input.featurePrompt.substring(0, 80)}`);
    console.log(`\n   Spec: ${input.specPath}`);
    console.log("   Review then run: npm run build:oneshot -- --spec=" + input.specPath);
    return;
  }

  writeFileEnsuringDir(input.specPath, updatedSpec);
  log.info("Updated spec written", { path: input.specPath });

  // Step 5: Trigger One-Shot rebuild
  log.info("Triggering One-Shot rebuild");
  const specDir = path.dirname(input.specPath);
  const outputDir = path.resolve(specDir, "..", "build-output");

  const { result, output } = await runOneshotBuild({
    specPath: input.specPath,
    outputDir,
    mode: "refactor",
  });

  const duration = Date.now() - startTime;

  if (result.success && output) {
    console.log("\n✅ Feature Addition Complete");
    console.log(`   Project: ${projectName}`);
    console.log(`   Files: ${output.filesGenerated.length}`);
    console.log(`   Duration: ${duration}ms`);
  } else {
    console.error("\n❌ Feature Addition Failed");
    console.error(`   Errors: ${result.errors.join(", ")}`);
    process.exit(1);
  }
}

/**
 * Update an existing spec with a new feature description.
 */
function updateSpecWithFeature(
  existingSpec: string,
  featurePrompt: string,
  currentVersion: string
): string {
  const newVersion = incrementVersion(currentVersion);
  const now = new Date().toISOString().split("T")[0];
  const featureId = `US-${Date.now().toString().slice(-4)}`;

  let updated = existingSpec
    .replace(/\*\*Version:\*\*\s*.+/, `**Version:** ${newVersion}`)
    .replace(/\*\*Last Updated:\*\*\s*.+/, `**Last Updated:** ${now}`);

  // Append new user story
  const newUserStory = `\n| ${featureId} | ${featurePrompt} | To be defined | P1 |`;
  const userStoryTableEnd = updated.indexOf("\n### 2.4", updated.indexOf("### 2.3"));
  if (userStoryTableEnd > -1) {
    updated = updated.substring(0, userStoryTableEnd) + newUserStory + updated.substring(userStoryTableEnd);
  } else {
    updated += `\n\n### Feature Addition: ${featureId}\n\n**Description:** ${featurePrompt}\n\n**Added:** ${now}\n`;
  }

  // Update changelog
  const changelogEntry = `\n| ${newVersion} | ${now} | ADLC Engine | Feature: ${featurePrompt.substring(0, 60)} |`;
  const changelogIdx = updated.indexOf("## 9. Changelog");
  if (changelogIdx > -1) {
    const tableEnd = updated.indexOf("\n\n", changelogIdx + 50);
    if (tableEnd > -1) {
      updated = updated.substring(0, tableEnd) + changelogEntry + updated.substring(tableEnd);
    }
  }

  return updated;
}

/**
 * Increment the patch version of a semver string.
 */
function incrementVersion(version: string): string {
  const parts = version.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join(".");
}

// ─── CLI Entry Point ──────────────────────────────────────────────

if (require.main === module) {
  const program = new Command();
  program
    .name("feature-add")
    .description("Feature Addition Loop — Updates spec then rebuilds")
    .requiredOption("--spec <path>", "Path to existing spec.md")
    .requiredOption("--prompt <description>", "Feature description")
    .option("--auto-approve", "Skip approval, rebuild immediately", false)
    .action(async (opts) => {
      await runFeatureAdd({
        specPath: path.resolve(opts.spec),
        featurePrompt: opts.prompt,
        autoApprove: opts.autoApprove,
      });
    });

  program.parse();
}

