import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiResponse } from "@netlaunch/shared";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(`❌ [API Error] ${req.method} ${req.url}:`, err);

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    const response: ApiResponse = {
      success: false,
      error: `Validation error: ${issues}`,
    };
    return res.status(400).json(response);
  }

  // Handle custom status codes if present
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  const response: ApiResponse = {
    success: false,
    error: message,
  };

  return res.status(status).json(response);
}
