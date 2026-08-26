import { Router, Request, Response, NextFunction } from "express";
import path from "path";
import { BugScannerAgent } from "../../agents/bug-scanner";
import { BugFixerAgent } from "../../agents/bug-fixer";
import { createContextLogger } from "../../utils/logger";

const log = createContextLogger("api-bugs");
const router = Router();

/**
 * POST /api/bugs/scan
 * Scan a codebase for bugs.
 */
router.post("/scan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scanPath, specPath, scanTypes } = req.body;

    if (!scanPath || typeof scanPath !== "string") {
      res.status(400).json({
        success: false,
        error: "Missing required field: scanPath",
      });
      return;
    }

    log.info("API: Starting bug scan", { scanPath });

    const agent = new BugScannerAgent();
    const context = { workingDir: process.cwd(), dryRun: false };

    const result = await agent.execute(
      {
        scanPath: path.resolve(scanPath),
        specPath: specPath ? path.resolve(specPath) : undefined,
        scanTypes: scanTypes || ["static", "tests"],
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

/**
 * POST /api/bugs/fix
 * Auto-fix a specific bug.
 */
router.post("/fix", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bug, specPath, sourcePath, dryRun } = req.body;

    if (!bug || !sourcePath) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: bug, sourcePath",
      });
      return;
    }

    log.info("API: Fixing bug", { bugId: bug.id, severity: bug.severity });

    const agent = new BugFixerAgent();
    const context = { workingDir: process.cwd(), dryRun: dryRun || false };

    const result = await agent.execute(
      {
        bug,
        specPath: specPath ? path.resolve(specPath) : "",
        sourcePath: path.resolve(sourcePath),
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
