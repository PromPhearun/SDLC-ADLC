import { Router, Request, Response, NextFunction } from "express";
import path from "path";
import { runOneshotBuild } from "../../runner/oneshot-builder";
import { createContextLogger } from "../../utils/logger";

const log = createContextLogger("api-build");
const router = Router();

/**
 * POST /api/build/oneshot
 * Run a one-shot build from a spec file.
 */
router.post("/oneshot", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { specPath, outputDir, mode } = req.body;

    if (!specPath || typeof specPath !== "string") {
      res.status(400).json({
        success: false,
        error: "Missing required field: specPath",
      });
      return;
    }

    log.info("API: Starting one-shot build", { specPath, mode });

    const { result, output } = await runOneshotBuild({
      specPath: path.resolve(specPath),
      outputDir: outputDir ? path.resolve(outputDir) : path.resolve("./build-output"),
      mode: mode || "fresh",
    });

    res.json({
      success: result.success,
      data: output,
      pipeline: {
        stages: result.stages,
        totalDuration: result.totalDuration,
        failedStage: result.failedStage,
        errors: result.errors,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
