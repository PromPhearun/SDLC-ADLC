# Spec-Driven Autonomous SDLC/ADLC Engine

An autonomous pipeline where AI handles the entire software lifecycle end-to-end: generating specs, indexing them, executing full "one-shot" app builds, scanning bugs, auto-fixing bugs, and processing whole-feature additions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ADLC Engine                            │
├─────────────┬──────────────┬──────────────┬─────────────────┤
│   Spec Gen  │  One-Shot    │  Bug Scan &  │  Notification   │
│   Agent     │  Builder     │  Auto-Fix    │  Digest         │
├─────────────┴──────────────┴──────────────┴─────────────────┤
│              Pipeline Orchestrator                           │
├─────────────────────────────────────────────────────────────┤
│              Spec Schema & Validation                        │
├─────────────────────────────────────────────────────────────┤
│              Centralized Spec Directory                      │
└─────────────────────────────────────────────────────────────┘
         ▲                    ▲
         │ CLI                │ Web UI
    ┌────┴────┐         ┌────┴────┐
    │Commander│         │ Express │
    │  CLI    │         │  API    │
    └─────────┘         └────┬────┘
                             │
                        ┌────┴────┐
                        │  React  │
                        │  + Vite │
                        │  + TW   │
                        └─────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Install frontend dependencies
cd web && npm install && cd ..

# ─── CLI Mode ─────────────────────────────────────────────

# Generate a spec from a product idea
npm run spec:generate -- --prompt="A real-time trading dashboard"

# Run a one-shot build from a spec
npm run build:oneshot -- --spec=specs/app-spec.md

# Add a new feature (updates spec + rebuilds)
npm run feature:add -- --spec=specs/app-spec.md --prompt="Add dark mode support"

# Audit all projects for spec coverage
npm run audit:specs

# Scan for bugs
npm run bug:scan

# Auto-fix detected bugs
npm run bug:fix

# Generate notification digest
npm run notify:digest

# ─── Web UI Mode ─────────────────────────────────────────

# Start both API server + React dev server (hot-reload)
npm run dev

# Or start them separately:
npm run dev:server   # API server on http://localhost:3000
npm run dev:ui       # React dev server on http://localhost:5173

# Production build
npm run build:ui     # Build React app
npm run start        # Start Express serving built frontend
```

## Core Principles

1. **Spec-First**: No code changes without an updated spec
2. **One-Shot Builds**: Full app generation from complete specs, not incremental patches
3. **Zero Tech Debt**: Every build refactors holistically
4. **Autonomous Loops**: Agents self-correct until specs are satisfied
5. **Noise Control**: All agent output compressed to executive summaries

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `/specs` | Centralized spec files |
| `/templates` | Gold-standard spec template |
| `/src/agents` | AI agent implementations |
| `/src/runner` | Build orchestrators |
| `/src/auditor` | Spec coverage auditor |
| `/src/notifications` | Log digest & Slack integration |
| `/src/schemas` | JSON Schema validators |
| `/src/utils` | Shared utilities |
| `/src/server` | Express API server (routes, middleware) |
| `/web` | React + Vite + Tailwind frontend |
| `/tests` | Unit & integration tests |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/specs/generate` | Generate spec from prompt |
| `GET` | `/api/specs` | List all specs |
| `GET` | `/api/specs/:name` | Get spec content |
| `POST` | `/api/build/oneshot` | One-shot build |
| `POST` | `/api/features/add` | Add feature to spec |
| `POST` | `/api/bugs/scan` | Scan for bugs |
| `POST` | `/api/bugs/fix` | Auto-fix a bug |
| `GET` | `/api/audit` | Run spec coverage audit |
| `GET` | `/api/notifications/digest` | Get notification digest |
