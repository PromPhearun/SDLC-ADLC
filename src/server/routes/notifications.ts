import { Router, Request, Response, NextFunction } from "express";
import { NotificationDigest } from "../../notifications/digest";
const router = Router();

/**
 * GET /api/notifications/digest
 * Generate a notification digest. Use ?demo=true for sample data.
 */
router.get("/digest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isDemo = req.query.demo === "true";
    const digest = new NotificationDigest();

    if (isDemo) {
      const now = new Date();
      digest.addEntries([
        { source: "spec-generator", severity: "success", message: "Spec generated for trading-platform v0.1.0", timestamp: new Date(now.getTime() - 300000) },
        { source: "oneshot-builder", severity: "success", message: "Build complete — 12 files generated in 4.2s", timestamp: new Date(now.getTime() - 240000) },
        { source: "bug-scanner", severity: "warning", message: "3 medium-severity issues found in src/routes/", timestamp: new Date(now.getTime() - 180000) },
        { source: "bug-fixer", severity: "success", message: "Auto-fixed 2 of 3 issues, 1 requires manual review", timestamp: new Date(now.getTime() - 120000) },
        { source: "feature-add", severity: "info", message: "Feature 'dark-mode' added to spec, rebuild triggered", timestamp: new Date(now.getTime() - 60000) },
      ]);
    }

    const summary = digest.generateDigest();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
