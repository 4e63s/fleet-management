import bcrypt from "bcryptjs";
import request from "supertest";
import { hashToken } from "../../src/lib/tokens";
import { m } from "../helpers/prismaMock";
import { bearer, buildTestApp, ID_A } from "../helpers/testApp";

let ctx: ReturnType<typeof buildTestApp>;
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await bcrypt.hash("Passw0rd!xyz", 4);
});

beforeEach(() => {
  ctx = buildTestApp();
});

const user = () => ({ id: ID_A, email: "ada@fleet.test", name: "Ada", role: "ADMIN", passwordHash });

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials (email is normalised)", async () => {
    m(ctx.prisma.user.findUnique).mockResolvedValue(user());
    m(ctx.prisma.refreshToken.create).mockResolvedValue({});

    const res = await request(ctx.app).post("/api/auth/login").send({ email: "  ADA@Fleet.test ", password: "Passw0rd!xyz" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: ID_A, email: "ada@fleet.test", name: "Ada", role: "ADMIN" });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(m(ctx.prisma.user.findUnique).mock.calls[0][0].where.email).toBe("ada@fleet.test");
  });

  it("returns 401 for a wrong password", async () => {
    m(ctx.prisma.user.findUnique).mockResolvedValue(user());
    const res = await request(ctx.app).post("/api/auth/login").send({ email: "ada@fleet.test", password: "nope" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for an invalid email", async () => {
    const res = await request(ctx.app).post("/api/auth/login").send({ email: "not-an-email", password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(ctx.app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
  });
});

describe("refresh and logout", () => {
  it("rotates a refresh token", async () => {
    m(ctx.prisma.refreshToken.findUnique).mockResolvedValue({
      id: "rt",
      userId: ID_A,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: user()
    });
    m(ctx.prisma.refreshToken.update).mockResolvedValue({});
    m(ctx.prisma.refreshToken.create).mockResolvedValue({});

    const token = "a".repeat(40);
    const res = await request(ctx.app).post("/api/auth/refresh").send({ refreshToken: token });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(token);
    expect(m(ctx.prisma.refreshToken.findUnique).mock.calls[0][0].where.tokenHash).toBe(hashToken(token));
  });

  it("rejects a refresh body that is too short", async () => {
    const res = await request(ctx.app).post("/api/auth/refresh").send({ refreshToken: "short" });
    expect(res.status).toBe(400);
  });

  it("logs out with 204", async () => {
    m(ctx.prisma.refreshToken.updateMany).mockResolvedValue({ count: 1 });
    const res = await request(ctx.app).post("/api/auth/logout").send({ refreshToken: "b".repeat(40) });
    expect(res.status).toBe(204);
  });
});

describe("GET /api/auth/me", () => {
  it("requires a token", async () => {
    const res = await request(ctx.app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user", async () => {
    m(ctx.prisma.user.findUnique).mockResolvedValue(user());
    const res = await request(ctx.app).get("/api/auth/me").set(bearer("ADMIN"));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("ada@fleet.test");
  });
});

describe("POST /api/auth/users", () => {
  const body = { email: "new@fleet.test", name: "New User", password: "Str0ngPassword1", role: "MANAGER" };

  it("lets an admin create a user", async () => {
    m(ctx.prisma.user.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: ID_A, ...data }));
    const res = await request(ctx.app).post("/api/auth/users").set(bearer("ADMIN")).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: ID_A, email: "new@fleet.test", name: "New User", role: "MANAGER" });
  });

  it("forbids managers", async () => {
    const res = await request(ctx.app).post("/api/auth/users").set(bearer("MANAGER")).send(body);
    expect(res.status).toBe(403);
  });

  it("enforces password strength", async () => {
    const res = await request(ctx.app).post("/api/auth/users").set(bearer("ADMIN")).send({ ...body, password: "weakpass" });
    expect(res.status).toBe(400);
  });

  it("maps a duplicate email to 409", async () => {
    m(ctx.prisma.user.create).mockRejectedValue({ code: "P2002" });
    const res = await request(ctx.app).post("/api/auth/users").set(bearer("ADMIN")).send(body);
    expect(res.status).toBe(409);
  });
});

describe("misc", () => {
  it("exposes a health check", async () => {
    const res = await request(ctx.app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const res = await request(ctx.app).get("/api/nothing-here");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
