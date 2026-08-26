import { Router, Request, Response, NextFunction } from "express";
import { runAudit } from "../../auditor/spec-auditor";
import { createContextLogger } from "../../utils/logger";

const log = createContextLogger("api-audit");
const router = Router();

/**
 * GET /api/audit
 * Run a full spec coverage audit.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scanPaths = req.query.paths
      ? (req.query.paths as string).split(",").map((p) => p.trim())
      : undefined;

    log.info("API: Running audit", { scanPaths });

    const report = await runAudit(scanPaths);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
