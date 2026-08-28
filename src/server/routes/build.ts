import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { createContextLogger } from "../../utils/logger";
import { readFileSafe, writeFileEnsuringDir } from "../../utils/file-io";
import {
  extractTitle,
  extractMeta,
  extractSections,
  countUserStories,
  countApiEndpoints,
  validateSections,
} from "../../utils/markdown";
import { SPEC_REQUIRED_SECTIONS } from "../../schemas/spec.schema";
import { createStage, PipelineContext } from "../../runner/pipeline";
import { OneshotBuilderOutput } from "../../agents/types";
import { CodeGeneratorAgent } from "../../agents/code-generator";
import { config } from "../../config";

const log = createContextLogger("api-build");
const router = Router();

/**
 * POST /api/build/oneshot
 * Run a one-shot build from a spec file.
 * Streams SSE progress events for each pipeline stage.
 */
router.post("/oneshot", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { specPath, outputDir, mode } = req.body;

    if (!specPath || typeof specPath !== "string") {
      res.status(400).json({ success: false, error: "Missing required field: specPath" });
      return;
    }

    // Build mode: "fresh" (default) cleans the output dir first;
    // "existing" preserves it and merges the scaffold into the project.
    const buildMode = mode === "existing" ? "existing" : "fresh";
    if (mode !== undefined && mode !== "fresh" && mode !== "existing") {
      res.status(400).json({ success: false, error: "Field 'mode' must be 'fresh' or 'existing'" });
      return;
    }

    log.info("API: Starting one-shot build", { specPath, mode: buildMode });

    // Set up SSE streaming response
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const resolvedSpecPath = path.resolve(specPath);
    const resolvedOutputDir = outputDir ? path.resolve(outputDir) : path.resolve("./build-output");

    // Define pipeline stages
    const validateSpec = createStage<string, { valid: boolean; content: string }>(
      "validate-spec", "Validate spec.md against required sections",
      async (inputSpecPath) => {
        const content = readFileSafe(inputSpecPath);
        if (!content) throw new Error(`Spec file not found: ${inputSpecPath}`);
        const validation = validateSections(content, [...SPEC_REQUIRED_SECTIONS]);
        if (!validation.valid) throw new Error(`Spec missing sections: ${validation.missing.join(", ")}`);
        return { valid: true, content };
      }
    );

    const parseSpec = createStage<{ valid: boolean; content: string }, { parsed: Record<string, unknown>; content: string }>(
      "parse-spec", "Parse spec.md into structured data",
      async (input) => {
        const { content } = input;
        return {
          parsed: {
            title: extractTitle(content), version: extractMeta(content, "Version"),
            status: extractMeta(content, "Status"), sections: extractSections(content),
            userStoryCount: countUserStories(content), apiEndpointCount: countApiEndpoints(content),
          },
          content,
        };
      }
    );

    const generateScaffold = createStage<{ parsed: Record<string, unknown>; content: string }, { files: string[] }>(
      "generate-scaffold", "Generate project directory structure",
      async (input, ctx) => {
        const files: string[] = [];
        const parsed = input.parsed as { title?: string };
        const appName = (parsed.title || "app").toLowerCase().replace(/\s+/g, "-");

        // Apply build mode before writing any scaffold files.
        const stageMode = ctx.config.mode === "existing" ? "existing" : "fresh";
        if (stageMode === "fresh" && !ctx.dryRun) {
          fs.rmSync(ctx.outputDir, { recursive: true, force: true });
          log.info("Fresh build: cleaned output directory", { outputDir: ctx.outputDir });
        } else if (stageMode === "existing") {
          log.info("Existing build: merging scaffold into current project", { outputDir: ctx.outputDir });
        }

        const scaffold: Record<string, string> = {
          "package.json": JSON.stringify({
            name: appName,
            version: "0.1.0",
            private: true,
            type: "module",
            scripts: {
              dev: "vite",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
            },
            devDependencies: {
              "@types/react": "^18.2.0",
              "@types/react-dom": "^18.2.0",
              "@vitejs/plugin-react": "^4.2.0",
              typescript: "^5.3.0",
              vite: "^5.0.0",
            },
          }, null, 2),
          "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${parsed.title || "Generated App"}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
          "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
});
`,
          "tsconfig.json": JSON.stringify({
            compilerOptions: {
              target: "ES2020",
              useDefineForClassFields: true,
              lib: ["ES2020", "DOM", "DOM.Iterable"],
              module: "ESNext",
              skipLibCheck: true,
              moduleResolution: "bundler",
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: "react-jsx",
              strict: true,
              noUnusedLocals: false,
              noUnusedParameters: false,
              noFallthroughCasesInSwitch: true,
            },
            include: ["src"],
          }, null, 2),
          "README.md": `# ${parsed.title || "Generated App"}\n\n> Generated by ADLC One-Shot Builder\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
          ".gitignore": "node_modules/\ndist/\n.env\n",
          "src/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
          "src/index.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f8fafc;
  color: #1e293b;
}

#root {
  min-height: 100vh;
}
`,
        };

        for (const [fileName, fileContent] of Object.entries(scaffold)) {
          const filePath = path.join(ctx.outputDir, fileName);
          if (!ctx.dryRun) writeFileEnsuringDir(filePath, fileContent);
          files.push(filePath);
        }
        return { files };
      }
    );

    const generateCode = createStage<{ files: string[] }, OneshotBuilderOutput>(
      "generate-code", "Generate application code from spec using AI",
      async (input, ctx) => {
        const specContent = readFileSafe(ctx.specPath) || "";
        const userStoryCount = countUserStories(specContent);
        const apiEndpointCount = countApiEndpoints(specContent);
        const generatedFiles = [...input.files];

        // Use AI-powered code generator if API key is available
        if (config.ai.apiKey) {
          log.info("Using AI-powered code generation", { model: config.ai.model });

          const codeGenerator = new CodeGeneratorAgent();
          const result = await codeGenerator.execute(ctx.specPath, {
            workingDir: ctx.outputDir,
            dryRun: ctx.dryRun,
          });

          if (result.success && result.data) {
            log.info("AI code generation successful", {
              filesGenerated: result.data.filesGenerated.length,
              duration: result.duration,
            });
            return result.data;
          }

          log.warn("AI code generation failed, falling back to scaffold", {
            errors: result.errors,
          });
        }

        // Fallback: generate basic scaffold
        log.info("Using scaffold-based code generation");

        // Generate App.tsx with spec-based content
        const specTitle = extractTitle(specContent) || "Generated App";
        const sections = extractSections(specContent);
        const sectionNames = Object.keys(sections);

        let appContent = `import React from "react";
import "./index.css";

export default function App() {
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#0f172a" }}>
          ${specTitle}
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.5rem" }}>
          Generated by ADLC One-Shot Builder
        </p>
      </header>

      <main>
`;

        if (sectionNames.length > 0) {
          appContent += `        {/* Spec Sections */}\n`;
          for (const section of sectionNames.slice(0, 8)) {
            const safeName = section.replace(/"/g, '\\"').replace(/{/g, '').replace(/}/g, '');
            appContent += `        <section style={{ marginBottom: "1.5rem", padding: "1.5rem", background: "white", borderRadius: "0.75rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1e293b", marginBottom: "0.75rem" }}>
            ${safeName}
          </h2>
          <p style={{ color: "#475569", lineHeight: "1.6" }}>
            Content from spec section: ${safeName}
          </p>
        </section>\n`;
          }
        } else {
          appContent += `        <section style={{ marginBottom: "1.5rem", padding: "1.5rem", background: "white", borderRadius: "0.75rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1e293b", marginBottom: "0.75rem" }}>
            Welcome
          </h2>
          <p style={{ color: "#475569", lineHeight: "1.6" }}>
            This application was generated from your spec. Add your components and features here.
          </p>
        </section>\n`;
        }

        if (userStoryCount > 0) {
          appContent += `
        {/* User Stories Summary */}
        <section style={{ marginBottom: "1.5rem", padding: "1.5rem", background: "#f0f9ff", borderRadius: "0.75rem", border: "1px solid #bae6fd" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#0c4a6e", marginBottom: "0.75rem" }}>
            📋 User Stories (${userStoryCount})
          </h2>
          <p style={{ color: "#0369a1" }}>
            This spec defines ${userStoryCount} user stories to be implemented.
          </p>
        </section>\n`;
        }

        if (apiEndpointCount > 0) {
          appContent += `
        {/* API Endpoints Summary */}
        <section style={{ marginBottom: "1.5rem", padding: "1.5rem", background: "#f0fdf4", borderRadius: "0.75rem", border: "1px solid #bbf7d0" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#14532d", marginBottom: "0.75rem" }}>
            🔌 API Endpoints (${apiEndpointCount})
          </h2>
          <p style={{ color: "#166534" }}>
            This spec defines ${apiEndpointCount} API endpoints to be implemented.
          </p>
        </section>\n`;
        }

        appContent += `      </main>

      <footer style={{ marginTop: "3rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", color: "#94a3b8", fontSize: "0.875rem" }}>
        Built with ADLC Engine
      </footer>
    </div>
  );
}
`;

        const appPath = path.join(ctx.outputDir, "src", "App.tsx");
        if (!ctx.dryRun) writeFileEnsuringDir(appPath, appContent);
        generatedFiles.push(appPath);

        if (apiEndpointCount > 0) {
          const p = path.join(ctx.outputDir, "src", "routes", "index.ts");
          if (!ctx.dryRun) writeFileEnsuringDir(p, `// Auto-generated API routes\n// ${apiEndpointCount} endpoints from spec\n\nimport { Router } from "express";\nconst router = Router();\nexport default router;\n`);
          generatedFiles.push(p);
        }
        if (userStoryCount > 0) {
          const p = path.join(ctx.outputDir, "src", "components", "index.ts");
          if (!ctx.dryRun) writeFileEnsuringDir(p, `// Auto-generated components\n// ${userStoryCount} user stories from spec\n\nexport {};\n`);
          generatedFiles.push(p);
        }
        return { filesGenerated: generatedFiles, iterations: 1, testsPassing: false, duration: 0 };
      }
    );

    // Execute pipeline with progress events
    const stages: Array<{ name: string; description: string; optional?: boolean; execute: (input: any, ctx: PipelineContext) => Promise<any> }> = [validateSpec, parseSpec, generateScaffold, generateCode];
    const totalStages = stages.length;

    sendEvent("progress", { step: 0, totalSteps: totalStages, stage: "initializing", label: "Initializing build pipeline...", percent: 0 });

    const context: PipelineContext = {
      workingDir: resolvedOutputDir, specPath: resolvedSpecPath,
      outputDir: resolvedOutputDir, config: { mode: buildMode }, results: new Map(), dryRun: false,
    };

    const pipelineStart = Date.now();
    const stageResults: Array<{ stage: string; success: boolean; duration: number; error?: string }> = [];
    let currentInput: unknown = resolvedSpecPath;
    let pipelineSuccess = true;
    let failedStage: string | undefined;
    const errors: string[] = [];

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageNum = i + 1;
      const percent = Math.round((stageNum / totalStages) * 100);

      sendEvent("progress", { step: stageNum, totalSteps: totalStages, stage: stage.name, label: stage.description, percent });

      const stageStart = Date.now();
      try {
        const output = await stage.execute(currentInput, context);
        const duration = Date.now() - stageStart;
        stageResults.push({ stage: stage.name, success: true, duration });
        context.results.set(stage.name, output);
        currentInput = output;
        sendEvent("stage-complete", { stage: stage.name, success: true, duration, step: stageNum, totalSteps: totalStages });
      } catch (error) {
        const duration = Date.now() - stageStart;
        const message = error instanceof Error ? error.message : String(error);
        stageResults.push({ stage: stage.name, success: false, duration, error: message });
        pipelineSuccess = false;
        failedStage = stage.name;
        errors.push(`[${stage.name}] ${message}`);
        sendEvent("stage-complete", { stage: stage.name, success: false, duration, error: message, step: stageNum, totalSteps: totalStages });
        if (!stage.optional) break;
      }
    }

    const totalDuration = Date.now() - pipelineStart;
    const output = (context.results.get("generate-code") as OneshotBuilderOutput) || null;

    sendEvent("result", { success: pipelineSuccess, data: output, pipeline: { stages: stageResults, totalDuration, failedStage, errors } });
    sendEvent("done", {});
    res.end();
  } catch (error) {
    if (res.headersSent) {
      const message = error instanceof Error ? error.message : String(error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      res.write(`event: done\ndata: {}\n\n`);
      res.end();
    } else {
      next(error);
    }
  }
});

export default router;
