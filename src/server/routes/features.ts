import { Router, Request, Response, NextFunction } from "express";
import path from "path";
import { runFeatureAdd } from "../../runner/feature-add";
import { createContextLogger } from "../../utils/logger";

const log = createContextLogger("api-features");
const router = Router();

/**
 * POST /api/features/add
 * Add a new feature to an existing spec and trigger rebuild.
 */
router.post("/add", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { specPath, featurePrompt, autoApprove } = req.body;

    if (!specPath || typeof specPath !== "string") {
      res.status(400).json({
        success: false,
        error: "Missing required field: specPath",
      });
      return;
    }

    if (!featurePrompt || typeof featurePrompt !== "string") {
      res.status(400).json({
        success: false,
        error: "Missing required field: featurePrompt",
      });
      return;
    }

    log.info("API: Adding feature", {
      specPath,
      feature: featurePrompt.substring(0, 100),
    });

    await runFeatureAdd({
      specPath: path.resolve(specPath),
      featurePrompt,
      autoApprove: autoApprove || false,
    });

    res.json({
      success: true,
      message: "Feature addition completed",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
