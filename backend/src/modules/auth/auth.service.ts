import bcrypt from "bcryptjs";
import type { PrismaClient, User } from "@prisma/client";
import type { Env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { generateRefreshToken, hashToken, signAccessToken } from "../../lib/tokens";
import type { CreateUserInput } from "./auth.schemas";

const BCRYPT_COST = process.env.NODE_ENV === "test" ? 4 : 12;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: User["role"];
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

const toPublic = (u: User): PublicUser => ({ id: u.id, email: u.email, name: u.name, role: u.role });

export function createAuthService(prisma: PrismaClient, env: Pick<Env, "JWT_ACCESS_SECRET" | "ACCESS_TOKEN_TTL" | "REFRESH_TOKEN_TTL_DAYS">) {
  async function issueTokens(user: User): Promise<AuthResult> {
    const refreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
      }
    });
    const accessToken = signAccessToken({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, env.ACCESS_TOKEN_TTL);
    return { accessToken, refreshToken, user: toPublic(user) };
  }

  return {
    async login(email: string, password: string): Promise<AuthResult> {
      const user = await prisma.user.findUnique({ where: { email } });
      // Same error for unknown email and wrong password to avoid user enumeration.
      const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
      if (!user || !valid) throw AppError.unauthorized("Invalid email or password");
      return issueTokens(user);
    },

    /** Rotating refresh tokens: each token is single use. Re-use of a revoked token revokes the whole family. */
    async refresh(token: string): Promise<AuthResult> {
      const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
      if (!record) throw AppError.unauthorized("Invalid refresh token");

      if (record.revokedAt) {
        await prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        throw AppError.unauthorized("Refresh token has been revoked");
      }
      if (record.expiresAt.getTime() < Date.now()) throw AppError.unauthorized("Refresh token has expired");

      await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
      return issueTokens(record.user);
    },

    async logout(token: string): Promise<void> {
      await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
    },

    async me(userId: string): Promise<PublicUser> {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw AppError.unauthorized("User no longer exists");
      return toPublic(user);
    },

    async createUser(input: CreateUserInput): Promise<PublicUser> {
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
      const user = await prisma.user.create({
        data: { email: input.email, name: input.name, role: input.role, passwordHash }
      });
      return toPublic(user);
    }
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
