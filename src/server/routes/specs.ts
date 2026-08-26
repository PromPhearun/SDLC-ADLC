import { Router, Request, Response, NextFunction } from "express";
import path from "path";
import { SpecGeneratorAgent } from "../../agents/spec-generator";
import { createContextLogger } from "../../utils/logger";

const log = createContextLogger("api-specs");
const router = Router();

/**
 * POST /api/specs/generate
 * Generate a spec.md from a product prompt.
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

    res.json({
      success: result.success,
      data: result.data,
      errors: result.errors,
      warnings: result.warnings,
      duration: result.duration,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
