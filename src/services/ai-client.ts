/**
 * AI Client Service for ADLC Engine
 * Wraps LiteLLM/OpenAI-compatible API for all AI operations.
 */

import { config } from "../config";
import { createContextLogger } from "../utils/logger";
import {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamingChunk,
  GenerateOptions,
  GenerateResult,
  StreamCallback,
  AIError,
} from "./ai-types";

const log = createContextLogger("ai-client");

const DEFAULT_OPTIONS = {
  temperature: 0.7,
  maxTokens: 4096,
  retries: 3,
  timeoutMs: 120000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make the actual HTTP request to the AI API.
 */
async function makeRequest(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const apiKey = config.ai.apiKey;
  const baseUrl = config.ai.baseUrl || "https://api.openai.com/v1";

  if (!apiKey) {
    throw { code: "NO_API_KEY", message: "AI API key not configured", retryable: false };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(DEFAULT_OPTIONS.timeoutMs),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw {
      code: "API_ERROR",
      message: `AI API error: ${response.status} - ${errorBody}`,
      status: response.status,
      retryable: response.status >= 500,
    };
  }

  return response.json() as Promise<ChatCompletionResponse>;
}

/**
 * Make a chat completion request (non-streaming).
 */
export async function generate(
  messages: ChatMessage[],
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const startTime = Date.now();
  const model = options.model || config.ai.model;
  const maxTokens = options.maxTokens || DEFAULT_OPTIONS.maxTokens;
  const temperature = options.temperature ?? DEFAULT_OPTIONS.temperature;
  const retries = options.retries ?? DEFAULT_OPTIONS.retries;

  const request: ChatCompletionRequest = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stop: options.stop,
    stream: false,
  };

  log.info("AI request", { model, messageCount: messages.length, maxTokens, temperature });

  let lastError: AIError | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await makeRequest(request);
      const duration = Date.now() - startTime;

      log.info("AI response", {
        model: response.model,
        tokens: response.usage.total_tokens,
        duration: `${duration}ms`,
        finishReason: response.choices[0]?.finish_reason,
      });

      return {
        content: response.choices[0]?.message?.content || "",
        model: response.model,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        },
        duration,
        finishReason: response.choices[0]?.finish_reason || "unknown",
      };
    } catch (error) {
      lastError = error instanceof Error
        ? { code: "REQUEST_FAILED", message: error.message, retryable: attempt < retries }
        : { code: "UNKNOWN", message: String(error), retryable: attempt < retries };

      log.warn(`AI request failed (attempt ${attempt}/${retries})`, { error: lastError.message });

      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await sleep(delay);
      }
    }
  }

  throw lastError || { code: "MAX_RETRIES", message: "Max retries exceeded", retryable: false };
}

/**
 * Make a streaming chat completion request.
 * Calls onChunk for each chunk received.
 */
export async function generateStream(
  messages: ChatMessage[],
  onChunk: StreamCallback,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const startTime = Date.now();
  const model = options.model || config.ai.model;
  const maxTokens = options.maxTokens || DEFAULT_OPTIONS.maxTokens;
  const temperature = options.temperature ?? DEFAULT_OPTIONS.temperature;

  const request: ChatCompletionRequest = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stop: options.stop,
    stream: true,
  };

  log.info("AI streaming request", { model, messageCount: messages.length });

  const apiKey = config.ai.apiKey;
  const baseUrl = config.ai.baseUrl || "https://api.openai.com/v1";

  if (!apiKey) {
    throw { code: "NO_API_KEY", message: "AI API key not configured", retryable: false };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(options.timeoutMs || DEFAULT_OPTIONS.timeoutMs),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw {
      code: "API_ERROR",
      message: `AI API error: ${response.status} - ${errorBody}`,
      status: response.status,
      retryable: response.status >= 500,
    };
  }

  if (!response.body) {
    throw { code: "NO_BODY", message: "Response body is null", retryable: false };
  }

  let fullContent = "";
  let finishReason: string | null = null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        onChunk("", true);
        continue;
      }

      try {
        const chunk: StreamingChunk = JSON.parse(data);
        const content = chunk.choices[0]?.delta?.content || "";
        finishReason = chunk.choices[0]?.finish_reason || finishReason;

        if (content) {
          fullContent += content;
          onChunk(content, false);
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }

  const duration = Date.now() - startTime;

  log.info("AI streaming complete", {
    model, contentLength: fullContent.length, duration: `${duration}ms`, finishReason,
  });

  return {
    content: fullContent,
    model,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    duration,
    finishReason: finishReason || "stop",
  };
}

/**
 * Simple helper: generate from a system prompt and user prompt.
 */
export async function generateFromPrompts(
  systemPrompt: string,
  userPrompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  return generate(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    options
  );
}

