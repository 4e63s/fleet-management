import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { AppError } from "./errors";

export interface AccessClaims {
  sub: string;
  role: Role;
}

export function signAccessToken(claims: AccessClaims, secret: string, ttl: string): string {
  return jwt.sign({ role: claims.role }, secret, {
    subject: claims.sub,
    expiresIn: ttl as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string, secret: string): AccessClaims {
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    if (!payload.sub || !payload.role) throw new Error("Malformed token");
    return { sub: payload.sub, role: payload.role as Role };
  } catch {
    throw AppError.unauthorized("Invalid or expired access token");
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
