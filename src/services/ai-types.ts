/**
 * AI Service Types for ADLC Engine
 * Types for AI/LLM interactions via LiteLLM-compatible API.
 */

/** Role in a chat conversation */
export type ChatRole = "system" | "user" | "assistant" | "tool";

/** A single message in a chat conversation */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
}

/** Request for chat completion */
export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

/** A single chunk from a streaming response */
export interface StreamingChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: ChatRole;
      content?: string;
    };
    finish_reason: string | null;
  }[];
}

/** Non-streaming chat completion response */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** AI error with context */
export interface AIError {
  code: string;
  message: string;
  status?: number;
  retryable: boolean;
}

/** Options for AI generation */
export interface GenerateOptions {
  /** Override default model */
  model?: string;
  /** Override default temperature */
  temperature?: number;
  /** Override default max tokens */
  maxTokens?: number;
  /** Stop sequences */
  stop?: string | string[];
  /** Whether to stream the response */
  stream?: boolean;
  /** Number of retries on failure */
  retries?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/** Result from AI generation */
export interface GenerateResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  duration: number;
  finishReason: string;
}

/** Callback for streaming chunks */
export type StreamCallback = (chunk: string, done: boolean) => void;
