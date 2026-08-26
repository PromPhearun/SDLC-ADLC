/**
 * Code Generator Agent
 * Orchestrates AI-powered code generation from spec requirements.
 */

import path from "path";
import { Agent, AgentContext, AgentResult, OneshotBuilderOutput } from "./types";
import { generateFromPrompts } from "../services/ai-client";
import {
  CODE_GEN_SYSTEM,
  buildReactComponentPrompt,
  buildExpressRoutePrompt,
  buildDataModelPrompt,
  buildPackageJsonPrompt,
} from "../services/prompts/code-generation";
import { readFileSafe, writeFileEnsuringDir } from "../utils/file-io";
import { extractTitle, extractSection } from "../utils/markdown";
import { createContextLogger } from "../utils/logger";
import { config } from "../config";

const log = createContextLogger("code-generator");

interface GeneratedFile {
  path: string;
  content: string;
  type: string;
}

export class CodeGeneratorAgent implements Agent<string, OneshotBuilderOutput> {
  readonly name = "code-generator";
  readonly description = "Generates full application code from spec using AI";

  async execute(
    specPath: string,
    context: AgentContext
  ): Promise<AgentResult<OneshotBuilderOutput>> {
    const startTime = Date.now();
    log.info("Starting AI-powered code generation", { specPath });

    try {
      const specContent = readFileSafe(specPath);
      if (!specContent) {
        return this.fail(`Spec file not found: ${specPath}`, startTime);
      }

      const title = extractTitle(specContent) || "generated-app";
      const projectSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const outputDir = context.workingDir;

      const userStories = this.extractUserStories(specContent);
      const apiEndpoints = this.extractApiEndpoints(specContent);
      const dataModels = this.extractDataModels(specContent);

      log.info("Parsed spec requirements", {
        userStories: userStories.length,
        apiEndpoints: apiEndpoints.length,
        dataModels: dataModels.length,
      });

      const generatedFiles: GeneratedFile[] = [];

      // 1. Generate package.json
      log.info("Generating package.json");
      const packageJson = await this.generatePackageJson(projectSlug);
      generatedFiles.push({ path: path.join(outputDir, "package.json"), content: packageJson, type: "config" });

      // 2. Generate data models
      for (const model of dataModels) {
        log.info("Generating data model", { model: model.name });
        const modelFiles = await this.generateDataModel(model, outputDir);
        generatedFiles.push(...modelFiles);
      }

      // 3. Generate Express routes
      if (apiEndpoints.length > 0) {
        log.info("Generating API routes", { count: apiEndpoints.length });
        const routeFiles = await this.generateRoutes(apiEndpoints, dataModels, outputDir);
        generatedFiles.push(...routeFiles);
      }

      // 4. Generate React components
      for (const story of userStories) {
        log.info("Generating component", { story: story.id });
        const componentFiles = await this.generateComponent(story, outputDir);
        generatedFiles.push(...componentFiles);
      }

      // 5. Generate entry points and config
      const entryFiles = await this.generateEntryPoints(title, outputDir, apiEndpoints.length > 0);
      generatedFiles.push(...entryFiles);

      // 6. Write all files
      if (!context.dryRun) {
        for (const file of generatedFiles) {
          writeFileEnsuringDir(file.path, file.content);
        }
        log.info("All files written", { count: generatedFiles.length });
      }

      const duration = Date.now() - startTime;
      return {
        success: true,
        data: {
          filesGenerated: generatedFiles.map((f) => f.path),
          iterations: 1,
          testsPassing: false,
          duration,
        },
        errors: [],
        warnings: context.dryRun ? ["Dry run — files were not written"] : [],
        duration,
        metadata: {
          userStories: userStories.length,
          apiEndpoints: apiEndpoints.length,
          dataModels: dataModels.length,
          totalFiles: generatedFiles.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("Code generation failed", { error: message });
      return this.fail(message, startTime);
    }
  }

  // ─── Private methods ─────────────────────────────────────

  private async generatePackageJson(projectName: string): Promise<string> {
    const prompt = buildPackageJsonPrompt(projectName, []);
    const result = await generateFromPrompts(CODE_GEN_SYSTEM, prompt, {
      temperature: config.ai.codeGenTemperature,
      maxTokens: 2000,
    });

    let content = result.content.trim();
    if (content.startsWith("```json")) content = content.slice(7);
    if (content.startsWith("```")) content = content.slice(3);
    if (content.endsWith("```")) content = content.slice(0, -3);
    content = content.trim();

    try {
      JSON.parse(content);
      return content;
    } catch {
      return JSON.stringify({
        name: projectName, version: "0.1.0", private: true,
        scripts: { dev: "concurrently \"npm run dev:server\" \"npm run dev:client\"", test: "jest" },
        dependencies: { express: "^4.18.2", cors: "^2.8.5", "react": "^18.3.1", "react-dom": "^18.3.1" },
        devDependencies: { typescript: "^5.3.3", "@types/node": "^20.11.0", "ts-node": "^10.9.2", jest: "^29.7.0" },
      }, null, 2);
    }
  }

  private async generateDataModel(model: { name: string; fields: string[] }, outputDir: string): Promise<GeneratedFile[]> {
    const prompt = buildDataModelPrompt(model.name, model.fields, []);
    const result = await generateFromPrompts(CODE_GEN_SYSTEM, prompt, {
      temperature: config.ai.codeGenTemperature, maxTokens: 4000,
    });

    const files: GeneratedFile[] = [];
    const sections = this.parseMultiFileResponse(result.content);
    for (const [filename, content] of sections) {
      files.push({ path: path.join(outputDir, filename), content, type: "model" });
    }

    if (files.length === 0) {
      const modelContent = this.generateFallbackModel(model.name, model.fields);
      files.push({ path: path.join(outputDir, "src", "models", `${this.toCamelCase(model.name)}.ts`), content: modelContent, type: "model" });
    }

    return files;
  }

  private async generateRoutes(
    endpoints: Array<{ method: string; path: string; description: string }>,
    models: Array<{ name: string; fields: string[] }>,
    outputDir: string
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const modelNames = models.map((m) => m.name);

    for (const endpoint of endpoints) {
      const prompt = buildExpressRoutePrompt(endpoint.method, endpoint.path, endpoint.description, "", "", ["400 Bad Request", "404 Not Found", "500 Internal Server Error"], modelNames);
      const result = await generateFromPrompts(CODE_GEN_SYSTEM, prompt, { temperature: config.ai.codeGenTemperature, maxTokens: 3000 });

      const routeName = endpoint.path.replace(/[^a-zA-Z0-9]/g, "-").replace(/^-|-$/g, "");
      const fileName = `${endpoint.method.toLowerCase()}-${routeName}.ts`;
      files.push({ path: path.join(outputDir, "src", "routes", fileName), content: this.cleanCodeResponse(result.content), type: "route" });
    }

    const indexContent = this.generateRoutesIndex(endpoints);
    files.push({ path: path.join(outputDir, "src", "routes", "index.ts"), content: indexContent, type: "route" });
    return files;
  }

  private async generateComponent(story: { id: string; story: string; acceptanceCriteria: string }, outputDir: string): Promise<GeneratedFile[]> {
    const componentName = this.extractComponentName(story.story);
    const prompt = buildReactComponentPrompt(story.story, story.acceptanceCriteria, { "--color-primary": "#2563eb", "--color-secondary": "#64748b" }, []);
    const result = await generateFromPrompts(CODE_GEN_SYSTEM, prompt, { temperature: config.ai.codeGenTemperature, maxTokens: 4000 });
    return [{ path: path.join(outputDir, "src", "components", `${componentName}.tsx`), content: this.cleanCodeResponse(result.content), type: "component" }];
  }

  private async generateEntryPoints(title: string, outputDir: string, hasApi: boolean): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const routerImport = hasApi ? `import { router } from "./routes";` : "";
    const routerUse = hasApi ? `app.use("/api", router);` : "";

    const serverCode = `import express from "express";
import cors from "cors";
${routerImport}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
${routerUse}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "${title}" });
});

app.listen(PORT, () => {
  console.log(\`🚀 ${title} server running on port \${PORT}\`);
});

export default app;
`;
    files.push({ path: path.join(outputDir, "src", "server", "index.ts"), content: serverCode, type: "entry" });

    const mainCode = `// ${title} - Entry Point
// Generated by ADLC Engine

export { default as server } from "./server";
`;
    files.push({ path: path.join(outputDir, "src", "index.ts"), content: mainCode, type: "entry" });

    const readme = `# ${title}

> Generated by ADLC Engine

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm test\` - Run tests
- \`npm run lint\` - Lint code
`;
    files.push({ path: path.join(outputDir, "README.md"), content: readme, type: "config" });

    files.push({ path: path.join(outputDir, ".gitignore"), content: "node_modules/\ndist/\n.env\ncoverage/\n", type: "config" });

    const tsconfig = JSON.stringify({
      compilerOptions: { target: "ES2022", module: "commonjs", lib: ["ES2022", "DOM"], outDir: "./dist", rootDir: "./src", strict: true, esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true, resolveJsonModule: true, declaration: true, jsx: "react-jsx" },
      include: ["src/**/*"], exclude: ["node_modules", "dist"],
    }, null, 2);
    files.push({ path: path.join(outputDir, "tsconfig.json"), content: tsconfig, type: "config" });

    return files;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private extractUserStories(spec: string): Array<{ id: string; story: string; acceptanceCriteria: string }> {
    const stories: Array<{ id: string; story: string; acceptanceCriteria: string }> = [];
    const pattern = /\|\s*(US-\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/g;
    let match;
    while ((match = pattern.exec(spec)) !== null) {
      stories.push({ id: match[1], story: match[2].trim(), acceptanceCriteria: match[3].trim() });
    }
    return stories;
  }

  private extractApiEndpoints(spec: string): Array<{ method: string; path: string; description: string }> {
    const endpoints: Array<{ method: string; path: string; description: string }> = [];
    const pattern = /####\s+`(GET|POST|PUT|PATCH|DELETE)\s+(.+?)`/g;
    let match;
    while ((match = pattern.exec(spec)) !== null) {
      const afterHeading = spec.substring(match.index + match[0].length, match.index + match[0].length + 200);
      const descMatch = afterHeading.match(/\*\*Description:\*\*\s*(.+)/);
      endpoints.push({ method: match[1], path: match[2], description: descMatch ? descMatch[1].trim() : `${match[1]} ${match[2]}` });
    }
    return endpoints;
  }

  private extractDataModels(spec: string): Array<{ name: string; fields: string[] }> {
    const models: Array<{ name: string; fields: string[] }> = [];
    const section = extractSection(spec, "API Schemas & Data Contracts") || extractSection(spec, "Data Models") || "";
    const interfacePattern = /interface\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = interfacePattern.exec(section)) !== null) {
      const name = match[1];
      const fields = match[2].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//")).map((l) => l.replace(/;.*$/, "").trim()).filter(Boolean);
      if (fields.length > 0) models.push({ name, fields });
    }
    return models;
  }

  private parseMultiFileResponse(content: string): Map<string, string> {
    const files = new Map<string, string>();
    const sections = content.split(/===FILE:(.+?)===/g);
    for (let i = 1; i < sections.length; i += 2) {
      const filename = sections[i].trim();
      const fileContent = sections[i + 1]?.trim() || "";
      if (filename && fileContent) files.set(filename, this.cleanCodeResponse(fileContent));
    }
    return files;
  }

  private cleanCodeResponse(content: string): string {
    let cleaned = content.trim();
    if (cleaned.startsWith("```typescript") || cleaned.startsWith("```ts")) cleaned = cleaned.replace(/^```(?:typescript|ts)\n?/, "");
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\w*\n?/, "");
    if (cleaned.endsWith("```")) cleaned = cleaned.replace(/\n?```$/, "");
    return cleaned.trim();
  }

  private generateFallbackModel(name: string, fields: string[]): string {
    const interfaceName = name.replace(/[^a-zA-Z0-9]/g, "");
    const fieldLines = fields.map((f) => `  ${f};`).join("\n");
    return `/**\n * ${name} data model\n * Generated by ADLC Engine\n */\n\nexport interface ${interfaceName} {\n${fieldLines || "  id: string;\n  createdAt: Date;\n  updatedAt: Date;"}\n}\n\nexport type Create${interfaceName}Input = Omit<${interfaceName}, "id" | "createdAt" | "updatedAt">;\nexport type Update${interfaceName}Input = Partial<Create${interfaceName}Input>;\n`;
  }

  private generateRoutesIndex(endpoints: Array<{ method: string; path: string }>): string {
    const imports = endpoints.map((e, i) => {
      const routeName = e.path.replace(/[^a-zA-Z0-9]/g, "-").replace(/^-|-$/g, "");
      return `import { router as route${i} } from "./${e.method.toLowerCase()}-${routeName}";`;
    }).join("\n");
    const uses = endpoints.map((_, i) => `router.use(route${i});`).join("\n");
    return `import { Router } from "express";\n\n${imports}\n\nexport const router = Router();\n\n${uses}\n`;
  }

  private extractComponentName(story: string): string {
    return story.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2).slice(0, 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  }

  private toCamelCase(str: string): string {
    return str.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^[A-Z]/, (char) => char.toLowerCase());
  }

  private fail(message: string, startTime: number): AgentResult<OneshotBuilderOutput> {
    return { success: false, data: null, errors: [message], warnings: [], duration: Date.now() - startTime, metadata: {} };
  }
}

export default CodeGeneratorAgent;

