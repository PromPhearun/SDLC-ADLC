/**
 * Cross-runtime HTTP fetch helper.
 *
 * Prefers the native global `fetch` (Node >= 18, browsers) and transparently
 * falls back to node-fetch v2 on older runtimes (e.g. Node 16) where the
 * global `fetch` does not exist.
 */

import fetchNode from "node-fetch";
import { Readable } from "stream";

/**
 * Minimal init object supported by both native fetch and node-fetch v2.
 */
export interface HttpFetchInit {
  method?: string;
  headers?: Record<string, string> | string[][] | [string, string][];
  body?: string | null;
  signal?: AbortSignal | null;
}

/**
 * Minimal response shape used by the engine (compatible with both
 * undici/native Response and node-fetch v2 Response).
 */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(): Promise<any>;
  /** Web ReadableStream (native fetch) or Node.js Readable (node-fetch fallback). */
  body: unknown;
}

const nativeFetch: typeof fetchNode | undefined =
  typeof fetch === "function"
    ? (fetch as unknown as typeof fetchNode)
    : undefined;

/**
 * Perform an HTTP request using the runtime-appropriate fetch implementation.
 */
export function httpFetch(
  url: string,
  init: HttpFetchInit = {}
): Promise<HttpResponse> {
  // node-fetch v2's RequestInit is narrower than the union we accept
  // (e.g. body: null), so we bridge with a double cast.
  const nodeInit = init as unknown as Parameters<typeof fetchNode>[1];
  if (nativeFetch) {
    return nativeFetch(url, nodeInit) as Promise<HttpResponse>;
  }
  return fetchNode(url, nodeInit) as Promise<HttpResponse>;
}

/**
 * Yield newline-delimited lines from an HTTP response body, regardless of
 * whether the body is a Web ReadableStream (native fetch) or a Node.js
 * Readable stream (node-fetch fallback).
 */
export async function* iterBodyLines(
  body: unknown
): AsyncGenerator<string> {
  const stream = body as
    | ReadableStream<Uint8Array>
    | Readable
    | null
    | undefined;

  if (!stream) {
    return;
  }

  // Web ReadableStream (native fetch, Node >= 18)
  if (typeof (stream as ReadableStream).getReader === "function") {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) yield line;
    }
    if (buffer.length > 0) yield buffer;
    return;
  }

  // Node.js Readable stream (node-fetch fallback, Node 16)
  if (typeof (stream as Readable).on === "function") {
    let buffer = "";
    for await (const chunk of stream as Readable) {
      buffer +=
        typeof chunk === "string" ? chunk : (chunk as Buffer).toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) yield line;
    }
    if (buffer.length > 0) yield buffer;
    return;
  }

  throw new Error("Unsupported response body type");
}