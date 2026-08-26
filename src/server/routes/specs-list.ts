import { Router, Request, Response, NextFunction } from "express";
import { buildSpecsDirectory } from "../../auditor/directory-builder";
import { readFileSafe } from "../../utils/file-io";
import { config } from "../../config";
import { createContextLogger } from "../../utils/logger";

const log = createContextLogger("api-specs-list");
const router = Router();

/**
 * GET /api/specs
 * List all discovered specs with metadata.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scanPaths = req.query.paths
      ? (req.query.paths as string).split(",").map((p) => p.trim())
      : undefined;

    log.info("API: Listing specs");

    const directory = await buildSpecsDirectory(scanPaths);

    res.json({
      success: true,
      data: directory,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/specs/:projectName
 * Get a specific spec's content.
 */
router.get("/:projectName", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectName } = req.params;
    const specPath = `${config.paths.specs}/${projectName}/spec.md`;

    const content = readFileSafe(specPath);
    if (!content) {
      res.status(404).json({
        success: false,
        error: `Spec not found for project: ${projectName}`,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        projectName,
        content,
        path: specPath,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
