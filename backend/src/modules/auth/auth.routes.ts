import { Router, type RequestHandler } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createUserSchema, loginSchema, refreshSchema, type CreateUserInput, type LoginInput } from "./auth.schemas";
import type { AuthService } from "./auth.service";

export function createAuthRouter(service: AuthService, jwtSecret: string, loginLimiter?: RequestHandler) {
  const router = Router();
  const user = authenticate(jwtSecret);
  const loginGuard: RequestHandler[] = loginLimiter ? [loginLimiter] : [];

  router.post(
    "/login",
    loginGuard,
    validate({ body: loginSchema }),
    asyncHandler(async (req, res) => {
      const { email, password } = req.body as LoginInput;
      res.json(await service.login(email, password));
    })
  );

  router.post(
    "/refresh",
    validate({ body: refreshSchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.refresh((req.body as { refreshToken: string }).refreshToken));
    })
  );

  router.post(
    "/logout",
    validate({ body: refreshSchema }),
    asyncHandler(async (req, res) => {
      await service.logout((req.body as { refreshToken: string }).refreshToken);
      res.status(204).end();
    })
  );

  router.get(
    "/me",
    user,
    asyncHandler(async (req, res) => {
      res.json(await service.me(req.user!.id));
    })
  );

  router.post(
    "/users",
    user,
    authorize("ADMIN"),
    validate({ body: createUserSchema }),
    asyncHandler(async (req, res) => {
      res.status(201).json(await service.createUser(req.body as CreateUserInput));
    })
  );

  return router;
}
