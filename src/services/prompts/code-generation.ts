/**
 * Prompt templates for Code Generation.
 * Generates real application code from spec requirements.
 */

export const CODE_GEN_SYSTEM = `You are an expert full-stack TypeScript developer. You generate production-ready, complete source code files from product specifications.

Rules:
1. Output ONLY the code content for the requested file. No explanations, no markdown fences, no meta-commentary.
2. Code must be complete, functional, and ready to run.
3. Use TypeScript with proper types.
4. Follow modern best practices and patterns.
5. Include proper error handling.
6. Include proper imports.
7. Code must compile without errors.`;

export function buildReactComponentPrompt(
  userStory: string,
  acceptanceCriteria: string,
  designTokens: Record<string, string>,
  existingComponents: string[]
): string {
  return `Generate a complete React component for this user story:

User Story: ${userStory}
Acceptance Criteria: ${acceptanceCriteria}

Design Tokens: ${JSON.stringify(designTokens, null, 2)}

Existing components that can be imported: ${existingComponents.join(", ") || "none"}

Requirements:
- Use React 18 with hooks (useState, useEffect, etc.)
- Use TypeScript with proper types
- Use Tailwind CSS for styling (use the design tokens above)
- Include proper ARIA labels for accessibility
- Handle loading, error, and empty states
- Export as default export
- Include proper prop types

Generate the COMPLETE component file now:`;
}

export function buildExpressRoutePrompt(
  method: string,
  path: string,
  description: string,
  requestSchema: string,
  responseSchema: string,
  errorResponses: string[],
  dataModels: string[]
): string {
  return `Generate a complete Express.js route handler:

Method: ${method}
Path: ${path}
Description: ${description}
Request Schema: ${requestSchema}
Response Schema: ${responseSchema}
Error Responses: ${errorResponses.join(", ")}
Available Data Models: ${dataModels.join(", ") || "none"}

Requirements:
- Use Express.js with TypeScript
- Use express Router
- Include input validation
- Include proper error handling with try/catch
- Return proper HTTP status codes
- Include JSDoc comments
- Export the router as default

Generate the COMPLETE route handler file now:`;
}

export function buildDataModelPrompt(
  modelName: string,
  fields: string[],
  relationships: string[]
): string {
  return `Generate a complete TypeScript data model:

Model Name: ${modelName}
Fields: ${fields.join(", ")}
Relationships: ${relationships.join(", ") || "none"}

Generate THREE files in a single response, separated by ===FILE:filename=== markers:

1. ===FILE:src/models/{modelName}.ts===
   - TypeScript interface with all fields
   - Proper types (string, number, boolean, Date, etc.)
   - Optional fields marked with ?
   - JSDoc comments for each field

2. ===FILE:src/schemas/{modelName}.schema.ts===
   - Ajv JSON Schema for validation
   - Required fields, types, formats
   - Export the schema object

3. ===FILE:src/repositories/{modelName}.repository.ts===
   - CRUD operations (create, findById, findAll, update, delete)
   - In-memory storage (Map) for now
   - Proper TypeScript types
   - Error handling

Generate all three files now:`;
}

export function buildTestPrompt(
  targetFile: string,
  targetType: "component" | "route" | "model",
  spec: string
): string {
  return `Generate comprehensive tests for this file:

File: ${targetFile}
Type: ${targetType}
Spec Context: ${spec.substring(0, 500)}

Requirements:
- Use Jest as the test framework
- Use @testing-library/react for React components
- Test all public functions/methods/components
- Test success cases and error cases
- Test edge cases
- Use descriptive test names
- Include proper setup/teardown
- Mock external dependencies

Generate the COMPLETE test file now:`;
}

export function buildPackageJsonPrompt(projectName: string, features: string[]): string {
  return `Generate a complete package.json for this project:

Project Name: ${projectName}
Features: ${features.join(", ")}

Requirements:
- Include all necessary dependencies for a React + Express + TypeScript project
- Include dev dependencies (TypeScript, testing, linting)
- Include useful scripts (dev, build, test, lint, start)
- Use latest stable versions
- Output ONLY the JSON content, no markdown fences

Generate the package.json now:`;
}
