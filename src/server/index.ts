import express from "express";
import cors from "cors";
import path from "path";
import { createContextLogger } from "../utils/logger";
import { errorHandler } from "./middleware/error-handler";

// Route imports
import specsRoutes from "./routes/specs";
import specsListRoutes from "./routes/specs-list";
import buildRoutes from "./routes/build";
import featuresRoutes from "./routes/features";
import bugsRoutes from "./routes/bugs";
import auditRoutes from "./routes/audit";
import notificationsRoutes from "./routes/notifications";

const log = createContextLogger("server");

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// ─── Middleware ──────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173", // Vite dev server
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

// Request logging
app.use((req, _res, next) => {
  log.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== "GET" ? req.body : undefined,
  });
  next();
});

// ─── API Routes ─────────────────────────────────────────────

app.use("/api/specs", specsRoutes);
app.use("/api/specs", specsListRoutes);
app.use("/api/build", buildRoutes);
app.use("/api/features", featuresRoutes);
app.use("/api/bugs", bugsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/notifications", notificationsRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "v3-adlc-engine",
    timestamp: new Date().toISOString(),
  });
});

// ─── Serve Frontend (Production) ────────────────────────────

if (process.env.NODE_ENV === "production") {
  const webDist = path.join(__dirname, "../../web/dist");
  app.use(express.static(webDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

// ─── Error Handler ──────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    log.info(`V3 ADLC Engine API server running`, { port: PORT });
    console.log(`\n🚀 V3 ADLC Engine API`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`\n   Endpoints:`);
    console.log(`   POST /api/specs/generate     — Generate spec from prompt`);
    console.log(`   GET  /api/specs               — List all specs`);
    console.log(`   GET  /api/specs/:name         — Get spec content`);
    console.log(`   POST /api/build/oneshot       — One-shot build`);
    console.log(`   POST /api/features/add        — Add feature`);
    console.log(`   POST /api/bugs/scan           — Scan for bugs`);
    console.log(`   POST /api/bugs/fix            — Auto-fix bug`);
    console.log(`   GET  /api/audit               — Run spec audit`);
    console.log(`   GET  /api/notifications/digest — Get digest`);
    console.log();
  });
}

export default app;
