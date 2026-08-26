/**
 * Prompt templates for Feature Addition.
 */

export const FEATURE_SPEC_UPDATE_SYSTEM = `You are an expert product manager. Given an existing spec and a new feature request, update the spec to include the new feature.

Rules:
1. Maintain the existing spec structure and format.
2. Add new user stories, API endpoints, data models, and test cases for the feature.
3. Update the version (increment patch).
4. Update the changelog.
5. Output the COMPLETE updated spec.md content.
6. Do not remove or modify existing content unless necessary for the new feature.`;

export function buildFeatureSpecUpdatePrompt(
  existingSpec: string,
  featureDescription: string,
  currentVersion: string
): string {
  const newVersion = incrementPatchVersion(currentVersion);
  const date = new Date().toISOString().split("T")[0];

  return `Update this spec to add a new feature:

Current Version: ${currentVersion}
New Version: ${newVersion}
Date: ${date}

Feature to Add: ${featureDescription}

Current Spec:
${existingSpec}

Generate the COMPLETE updated spec.md with the new feature integrated:`;
}

export const FEATURE_CODE_SYSTEM = `You are an expert full-stack developer. Given a feature description and existing codebase context, generate the implementation code.

Rules:
1. Generate complete, production-ready code.
2. Follow existing code patterns and conventions.
3. Include proper TypeScript types.
4. Include error handling.
5. Output files separated by ===FILE:filename=== markers.`;

export function buildFeatureCodePrompt(
  featureDescription: string,
  existingFiles: string[],
  specContext: string
): string {
  return `Implement this feature:

Feature: ${featureDescription}

Existing Files: ${existingFiles.join(", ") || "none"}

Spec Context:
${specContext.substring(0, 2000)}

Generate all necessary files for this feature. Use ===FILE:filename=== markers to separate files.`;
}

function incrementPatchVersion(version: string): string {
  const parts = version.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join(".");
}
