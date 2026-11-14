import crypto from "crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Role } from "@prisma/client";
import { AppError } from "../lib/errors";
import { verifyAccessToken } from "../lib/tokens";

export function authenticate(secret: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return next(AppError.unauthorized("Missing bearer token"));
    }
    try {
      const claims = verifyAccessToken(header.slice("Bearer ".length).trim(), secret);
      req.user = { id: claims.sub, role: claims.role };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}

/** Authenticates GPS/OBD devices with a shared key sent in the x-device-key header. */
export function deviceAuth(expectedKey: string): RequestHandler {
  const expected = Buffer.from(expectedKey);
  return (req, _res, next) => {
    const provided = Buffer.from(String(req.headers["x-device-key"] ?? ""));
    const ok = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
    if (!ok) return next(AppError.unauthorized("Invalid device key"));
    next();
  };
}
