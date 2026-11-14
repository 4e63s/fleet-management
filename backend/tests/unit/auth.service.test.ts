import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { hashToken, verifyAccessToken } from "../../src/lib/tokens";
import { createAuthService } from "../../src/modules/auth/auth.service";
import { createPrismaMock, m } from "../helpers/prismaMock";
import { ID_A, testEnv } from "../helpers/testApp";

const PASSWORD = "Passw0rd!xyz";
let passwordHash: string;
let prisma: PrismaClient;
let service: ReturnType<typeof createAuthService>;

const dbUser = () => ({ id: ID_A, email: "a@fleet.test", name: "Ada", role: "ADMIN" as const, passwordHash });

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});

beforeEach(() => {
  prisma = createPrismaMock();
  service = createAuthService(prisma, testEnv);
});

describe("login", () => {
  it("returns tokens and a public user, and stores only the refresh token hash", async () => {
    m(prisma.user.findUnique).mockResolvedValue(dbUser());
    m(prisma.refreshToken.create).mockResolvedValue({});

    const result = await service.login("a@fleet.test", PASSWORD);

    expect(result.user).toEqual({ id: ID_A, email: "a@fleet.test", name: "Ada", role: "ADMIN" });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(verifyAccessToken(result.accessToken, testEnv.JWT_ACCESS_SECRET).sub).toBe(ID_A);

    const data = m(prisma.refreshToken.create).mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashToken(result.refreshToken));
    expect(data.tokenHash).not.toBe(result.refreshToken);
    expect(data.userId).toBe(ID_A);
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a wrong password", async () => {
    m(prisma.user.findUnique).mockResolvedValue(dbUser());
    await expect(service.login("a@fleet.test", "wrong")).rejects.toMatchObject({ status: 401 });
    expect(m(prisma.refreshToken.create)).not.toHaveBeenCalled();
  });

  it("rejects an unknown email with the same message", async () => {
    m(prisma.user.findUnique).mockResolvedValue(null);
    await expect(service.login("nobody@fleet.test", PASSWORD)).rejects.toThrow("Invalid email or password");
  });
});

describe("refresh", () => {
  const record = (over: Record<string, unknown> = {}) => ({
    id: "rt-1",
    userId: ID_A,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: dbUser(),
    ...over
  });

  it("rotates the token", async () => {
    m(prisma.refreshToken.findUnique).mockResolvedValue(record());
    m(prisma.refreshToken.update).mockResolvedValue({});
    m(prisma.refreshToken.create).mockResolvedValue({});

    const result = await service.refresh("old-token");

    expect(m(prisma.refreshToken.findUnique).mock.calls[0][0].where.tokenHash).toBe(hashToken("old-token"));
    expect(m(prisma.refreshToken.update).mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
    expect(result.refreshToken).not.toBe("old-token");
    expect(m(prisma.refreshToken.create)).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown token", async () => {
    m(prisma.refreshToken.findUnique).mockResolvedValue(null);
    await expect(service.refresh("nope")).rejects.toMatchObject({ status: 401 });
  });

  it("revokes every active token when a revoked one is replayed", async () => {
    m(prisma.refreshToken.findUnique).mockResolvedValue(record({ revokedAt: new Date() }));
    m(prisma.refreshToken.updateMany).mockResolvedValue({ count: 2 });

    await expect(service.refresh("replayed")).rejects.toMatchObject({ status: 401 });

    const call = m(prisma.refreshToken.updateMany).mock.calls[0][0];
    expect(call.where).toEqual({ userId: ID_A, revokedAt: null });
    expect(call.data.revokedAt).toBeInstanceOf(Date);
  });

  it("rejects an expired token", async () => {
    m(prisma.refreshToken.findUnique).mockResolvedValue(record({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.refresh("expired")).rejects.toThrow(/expired/);
    expect(m(prisma.refreshToken.update)).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("revokes the presented token", async () => {
    m(prisma.refreshToken.updateMany).mockResolvedValue({ count: 1 });
    await service.logout("some-token");
    const call = m(prisma.refreshToken.updateMany).mock.calls[0][0];
    expect(call.where).toEqual({ tokenHash: hashToken("some-token"), revokedAt: null });
  });
});

describe("me", () => {
  it("returns the public user", async () => {
    m(prisma.user.findUnique).mockResolvedValue(dbUser());
    await expect(service.me(ID_A)).resolves.toMatchObject({ email: "a@fleet.test" });
  });

  it("returns 401 when the user was deleted", async () => {
    m(prisma.user.findUnique).mockResolvedValue(null);
    await expect(service.me(ID_A)).rejects.toMatchObject({ status: 401 });
  });
});

describe("createUser", () => {
  it("hashes the password before storing", async () => {
    m(prisma.user.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: ID_A, ...data }));

    const created = await service.createUser({ email: "new@fleet.test", name: "New", password: "Sup3rSecretPass", role: "MANAGER" });

    const data = m(prisma.user.create).mock.calls[0][0].data;
    expect(data.passwordHash).not.toBe("Sup3rSecretPass");
    expect(await bcrypt.compare("Sup3rSecretPass", data.passwordHash)).toBe(true);
    expect(created).toEqual({ id: ID_A, email: "new@fleet.test", name: "New", role: "MANAGER" });
  });
});
