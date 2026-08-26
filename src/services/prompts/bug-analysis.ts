/**
 * Prompt templates for Bug Analysis and Fixing.
 */

export const BUG_ANALYSIS_SYSTEM = `You are an expert code reviewer and bug detector. You analyze code for bugs, security issues, performance problems, and spec violations.

When analyzing code, provide a JSON array of bug reports. Each bug must have:
- id: unique identifier (format: BUG-XXXX)
- severity: "critical" | "high" | "medium" | "low"
- category: "syntax" | "type" | "logic" | "security" | "performance" | "spec-violation"
- file: file path
- line: line number (if applicable)
- message: clear description of the bug
- suggestion: how to fix it

Output ONLY the JSON array, no explanations.`;

export function buildBugAnalysisPrompt(
  code: string,
  filePath: string,
  specContext?: string
): string {
  return `Analyze this code for bugs, security issues, and problems:

File: ${filePath}
${specContext ? `\nSpec Context:\n${specContext.substring(0, 1000)}` : ""}

\`\`\`typescript
${code}
\`\`\`

Find all bugs, issues, and problems. Output a JSON array of bug reports.`;
}

export const BUG_FIX_SYSTEM = `You are an expert bug fixer. Given a bug report and the source code, generate a complete fix.

Rules:
1. Output ONLY the fixed code, no explanations.
2. The fix must be minimal - change only what's necessary.
3. The fix must not introduce new bugs.
4. Preserve the original code style and patterns.
5. Include comments explaining the fix if it's complex.`;

export function buildBugFixPrompt(
  bugMessage: string,
  bugCategory: string,
  sourceCode: string,
  filePath: string
): string {
  return `Fix this bug:

Bug: ${bugMessage}
Category: ${bugCategory}
File: ${filePath}

Current code:
\`\`\`typescript
${sourceCode}
\`\`\`

Generate the COMPLETE fixed file:`;
}
