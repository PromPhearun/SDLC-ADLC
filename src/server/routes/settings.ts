import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { createContextLogger } from "../../utils/logger";
import { config } from "../../config";
import { httpFetch } from "../../utils/http";

const log = createContextLogger("api-settings");
const router = Router();

const SETTINGS_FILE = path.join(config.paths.root, ".agent-settings.json");

interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

interface AgentSettings {
  "spec-generator": LLMConfig;
  "oneshot-builder": LLMConfig;
  "bug-scanner": LLMConfig;
}

function getDefaultLLMConfig(): LLMConfig {
  return {
    provider: config.ai.provider,
    model: config.ai.model,
    apiKey: config.ai.apiKey,
    baseUrl: config.ai.baseUrl,
    temperature: config.ai.temperature,
    maxTokens: config.ai.maxTokens,
  };
}

function getDefaultSettings(): AgentSettings {
  return {
    "spec-generator": { ...getDefaultLLMConfig(), temperature: config.ai.specGenTemperature },
    "oneshot-builder": { ...getDefaultLLMConfig(), temperature: config.ai.codeGenTemperature },
    "bug-scanner": { ...getDefaultLLMConfig(), temperature: config.ai.bugFixTemperature },
  };
}

function loadSettings(): AgentSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const saved = JSON.parse(raw) as Partial<AgentSettings>;
      const defaults = getDefaultSettings();
      return { ...defaults, ...saved };
    }
  } catch (error) {
    log.warn("Failed to load settings file, using defaults", { error });
  }
  return getDefaultSettings();
}

function saveSettings(settings: AgentSettings): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

const PROVIDERS = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-preview"] },
  { id: "anthropic", name: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1", models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"] },
  { id: "google", name: "Google (Gemini)", baseUrl: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"] },
  { id: "mistral", name: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", models: ["mistral-large-latest", "mistral-medium-latest"] },
  { id: "litellm", name: "LiteLLM (Proxy)", baseUrl: "https://litellm.deriv.ai/v1", models: ["MiMo-V2.5-Pro", "gpt-4o", "claude-sonnet-4-20250514"] },
  { id: "ollama", name: "Ollama (Local)", baseUrl: "http://localhost:11434/v1", models: ["llama3.1", "codellama", "mistral", "qwen2.5"] },
  { id: "custom", name: "Custom / Self-Hosted", baseUrl: "", models: [] },
];

export default router;

// ─── Route Handlers ─────────────────────────────────────────

router.get("/llm", async (_req: Request, res: Response) => {
  try {
    const settings = loadSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

router.put("/llm/:agentId", async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const validAgents = ["spec-generator", "oneshot-builder", "bug-scanner"];

    if (!validAgents.includes(agentId)) {
      res.status(400).json({ success: false, error: `Invalid agent ID. Must be one of: ${validAgents.join(", ")}` });
      return;
    }

    const updates = req.body as Partial<LLMConfig>;
    const settings = loadSettings();
    settings[agentId as keyof AgentSettings] = { ...settings[agentId as keyof AgentSettings], ...updates };
    saveSettings(settings);

    log.info("Agent LLM config updated", { agentId });
    res.json({ success: true, data: settings[agentId as keyof AgentSettings] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

router.post("/llm/test", async (req: Request, res: Response) => {
  try {
    const { apiKey, baseUrl, model } = req.body;

    if (!apiKey || !baseUrl || !model) {
      res.status(400).json({ success: false, error: "Missing required fields: apiKey, baseUrl, model" });
      return;
    }

    log.info("Testing LLM connection", { baseUrl, model });
    const startTime = Date.now();

    const response = await httpFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say 'Connection successful!' in exactly 3 words." }],
        max_tokens: 20,
        temperature: 0,
      }),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text();
      res.json({ success: false, error: `API returned ${response.status}: ${errorBody.substring(0, 200)}`, duration });
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { total_tokens?: number };
    };

    res.json({
      success: true,
      data: {
        response: data.choices?.[0]?.message?.content || "",
        model: data.model || model,
        tokens: data.usage?.total_tokens || 0,
        duration,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("LLM test failed", { error: message });
    res.json({ success: false, error: message });
  }
});

router.get("/providers", async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: PROVIDERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});