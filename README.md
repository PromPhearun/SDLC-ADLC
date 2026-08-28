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
| `/src/services` | AI client, types, and prompt templates |
| `/src/utils` | Shared utilities |
| `/src/server` | Express API server (routes, middleware) |
| `/web` | React + Vite + Tailwind frontend |
| `/build-output` | Generated application output |
| `/tests` | Unit & integration tests |

## API Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/health` | Health check | JSON |
| `POST` | `/api/specs/generate` | Generate spec from prompt | SSE stream |
| `GET` | `/api/specs` | List all specs | JSON |
| `GET` | `/api/specs/:name` | Get spec content | JSON |
| `PUT` | `/api/specs/save` | Save/update spec content | JSON |
| `POST` | `/api/build/oneshot` | One-shot build | SSE stream |
| `POST` | `/api/features/add` | Add feature to spec | JSON |
| `POST` | `/api/bugs/scan` | Scan for bugs | JSON |
| `POST` | `/api/bugs/fix` | Auto-fix a bug | JSON |
| `GET` | `/api/audit` | Run spec coverage audit | JSON |
| `GET` | `/api/notifications/digest` | Get notification digest | JSON |
| `POST` | `/api/github/clone` | Clone a Git repository | JSON |
| `POST` | `/api/github/push` | Stage, commit & push changes | JSON |
| `GET` | `/api/github/status` | Get git status for a repo | JSON |
| `GET` | `/api/github/repos` | List locally cloned repos | JSON |
| `DELETE` | `/api/github/repos/:name` | Delete a local repo | JSON |
| `GET` | `/api/settings/llm` | Get LLM configs for all agents | JSON |
| `PUT` | `/api/settings/llm/:agentId` | Update agent LLM config | JSON |
| `POST` | `/api/settings/llm/test` | Test LLM connection | JSON |
| `GET` | `/api/settings/providers` | List supported LLM providers | JSON |

### Real-Time Progress Streaming

The Spec Generator and One-Shot Builder endpoints use **Server-Sent Events (SSE)** to stream real-time progress updates to the client.

**Spec Generator** (`POST /api/specs/generate`) emits:
- `progress` — step-by-step updates (template loading → prompt analysis → content generation → file writing → finalization)
- `result` — final spec metadata (project name, version, user story count, API endpoint count, section count, output path, spec content)
- `done` — stream completion signal

**One-Shot Builder** (`POST /api/build/oneshot`) emits:
- `progress` — pipeline stage updates (validate-spec → parse-spec → generate-scaffold → generate-code)
- `stage-complete` — per-stage completion with success/failure status and duration in ms
- `result` — final build output (files generated, iterations, test status, pipeline summary)
- `done` — stream completion signal

Both endpoints also emit `error` events if something goes wrong mid-stream.

### Build Modes

The One-Shot Builder supports two build modes via the `mode` parameter:

| Mode | Description |
|------|-------------|
| `fresh` | Clean build from scratch (default) |
| `existing` | Build on top of existing project structure |

### Spec Editing

After generating a spec, the Web UI allows inline editing of the spec content. Use the `PUT /api/specs/save` endpoint to persist changes to disk.

### GitHub Integration

Clone, manage, and push to Git repositories directly from the Web UI. Repositories are stored in the `cloned-repos/` directory under the project root.

| Endpoint | Description |
|----------|-------------|
| `POST /api/github/clone` | Clone a repository by URL (optional: name, branch) |
| `POST /api/github/push` | Stage all changes, commit with message, and push to remote |
| `GET /api/github/status` | Get branch, ahead/behind counts, modified files, and recent commits |
| `GET /api/github/repos` | List all locally cloned repositories with metadata |
| `DELETE /api/github/repos/:name` | Delete a local repository from disk |

### Per-Agent LLM Settings

Each AI agent (Spec Generator, One-Shot Builder, Bug Scanner) can be configured with its own LLM provider, model, and parameters. Settings are persisted to `.agent-settings.json` and fall back to `.env` defaults.

**Supported Providers**: OpenAI, Anthropic, Google, Mistral, LiteLLM, Ollama, Custom

| Endpoint | Description |
|----------|-------------|
| `GET /api/settings/llm` | Get LLM configurations for all agents |
| `PUT /api/settings/llm/:agentId` | Update LLM config for a specific agent |
| `POST /api/settings/llm/test` | Test an LLM connection before saving |
| `GET /api/settings/providers` | List all supported provider presets |
