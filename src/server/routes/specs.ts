import { Router, Request, Response, NextFunction } from "express";
import path from "path";
import { SpecGeneratorAgent } from "../../agents/spec-generator";
import { createContextLogger } from "../../utils/logger";

const log = createContextLogger("api-specs");
const router = Router();

/**
 * POST /api/specs/generate
 * Generate a spec.md from a product prompt.
 * Streams SSE progress events as it processes each step.
 */
router.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, projectName, outputPath, constraints, dryRun } = req.body;

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({
        success: false,
        error: "Missing required field: prompt",
      });
      return;
    }

    log.info("API: Generating spec", { prompt: prompt.substring(0, 100) });

    // Set up SSE streaming response
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const sendEvent = (event: string, data: unknown) => {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      res.write(`event: ${event}\ndata: ${payload}\n\n`);
    };

    // Step 1: Loading template
    sendEvent("progress", { step: 1, totalSteps: 5, label: "Loading spec template...", percent: 10 });
    await delay(300);

    // Step 2: Analyzing prompt
    sendEvent("progress", { step: 2, totalSteps: 5, label: "Analyzing product description...", percent: 30 });
    await delay(400);

    // Step 3: Generating spec content
    sendEvent("progress", { step: 3, totalSteps: 5, label: "Generating spec content...", percent: 55 });

    const agent = new SpecGeneratorAgent();
    const context = {
      workingDir: process.cwd(),
      dryRun: dryRun || false,
    };

    const result = await agent.execute(
      {
        prompt,
        projectName,
        outputPath: outputPath ? path.resolve(outputPath) : undefined,
        constraints: constraints || undefined,
      },
      context
    );

    // Step 4: Writing spec file
    if (result.success) {
      sendEvent("progress", { step: 4, totalSteps: 5, label: dryRun ? "Previewing spec..." : "Writing spec to disk...", percent: 80 });
      await delay(200);
    }

    // Step 5: Complete
    sendEvent("progress", { step: 5, totalSteps: 5, label: "Finalizing...", percent: 100 });
    await delay(150);

    // Send the final result — flatten metadata to top level for frontend compatibility
    const responseData = result.success && result.data
      ? {
          projectName: result.data.metadata.projectName,
          version: result.data.metadata.version,
          userStoryCount: result.data.metadata.userStoryCount,
          apiEndpointCount: result.data.metadata.apiEndpointCount,
          sectionCount: result.data.metadata.sectionCount,
          outputPath: result.data.outputPath,
          specPreview: result.data.specContent.substring(0, 2000),
        }
      : null;

    sendEvent("result", {
      success: result.success,
      data: responseData,
      errors: result.errors,
      warnings: result.warnings,
      duration: result.duration,
    });

    sendEvent("done", {});
    res.end();
  } catch (error) {
    // If headers already sent (SSE stream), send error event and close
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default router;
