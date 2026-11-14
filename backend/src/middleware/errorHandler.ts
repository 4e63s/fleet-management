import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../lib/errors";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  const code = (err as { code?: string } | null)?.code;
  const type = (err as { type?: string } | null)?.type;

  if (type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Request body is not valid JSON" } });
    return;
  }
  if (code === "P2002") {
    res.status(409).json({ error: { code: "CONFLICT", message: "A record with the same unique value already exists" } });
    return;
  }
  if (code === "P2025") {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
    return;
  }
  if (code === "P2003") {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "A referenced record does not exist" } });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
};
