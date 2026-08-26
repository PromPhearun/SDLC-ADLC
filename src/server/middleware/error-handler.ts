import { Request, Response, NextFunction } from "express";
import { createContextLogger } from "../../utils/logger";

const log = createContextLogger("server");

export interface ApiError {
  status: number;
  message: string;
  details?: string[];
}

/**
 * Centralized error handling middleware for the API server.
 */
export function errorHandler(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if ("status" in err && typeof err.status === "number") {
    log.warn("API error", { status: err.status, message: err.message });
    res.status(err.status).json({
      success: false,
      error: err.message,
      details: err.details || [],
    });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  log.error("Unhandled error", { error: message, stack });

  res.status(500).json({
    success: false,
    error: "Internal server error",
    details: [message],
  });
}

/**
 * Create a typed API error.
 */
export function createApiError(
  status: number,
  message: string,
  details?: string[]
): ApiError {
  const error = new Error(message) as Error & ApiError;
  (error as any).status = status;
  (error as any).details = details;
  return error as unknown as ApiError;
}
