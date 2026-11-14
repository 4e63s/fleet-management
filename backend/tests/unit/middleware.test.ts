import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../src/lib/errors";
import { signAccessToken } from "../../src/lib/tokens";
import { authenticate, authorize, deviceAuth } from "../../src/middleware/auth";
import { errorHandler, notFoundHandler } from "../../src/middleware/errorHandler";
import { validate } from "../../src/middleware/validate";

const SECRET = "middleware-secret-middleware-secret-123";

const req = (partial: Partial<Request>) => partial as Request;

function mockRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
}

describe("authenticate", () => {
  it("rejects a missing header", () => {
    const next = jest.fn();
    authenticate(SECRET)(req({ headers: {} }), mockRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 401 });
  });

  it("rejects a non-bearer header", () => {
    const next = jest.fn();
    authenticate(SECRET)(req({ headers: { authorization: "Basic abc" } }), mockRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 401 });
  });

  it("rejects an invalid token", () => {
    const next = jest.fn();
    authenticate(SECRET)(req({ headers: { authorization: "Bearer nope" } }), mockRes(), next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
  });

  it("attaches the user for a valid token", () => {
    const token = signAccessToken({ sub: "u1", role: "MANAGER" }, SECRET, "5m");
    const request = req({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    authenticate(SECRET)(request, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(request.user).toEqual({ id: "u1", role: "MANAGER" });
  });
});

describe("authorize", () => {
  it("returns 401 without a user", () => {
    const next = jest.fn();
    authorize("ADMIN")(req({}), mockRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 401 });
  });

  it("returns 403 for a role that is not allowed", () => {
    const next = jest.fn();
    authorize("ADMIN")(req({ user: { id: "u", role: "DRIVER" } }), mockRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 403 });
  });

  it("passes for an allowed role", () => {
    const next = jest.fn();
    authorize("ADMIN", "MANAGER")(req({ user: { id: "u", role: "MANAGER" } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("deviceAuth", () => {
  const guard = deviceAuth("secret-device-key");

  it.each([[undefined], ["wrong-key-value!!"], ["short"]])("rejects %p", (key) => {
    const next = jest.fn();
    guard(req({ headers: key ? { "x-device-key": key } : {} }), mockRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 401 });
  });

  it("accepts the right key", () => {
    const next = jest.fn();
    guard(req({ headers: { "x-device-key": "secret-device-key" } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("validate", () => {
  it("replaces the body with parsed data", () => {
    const request = req({ body: { n: "5" } });
    const next = jest.fn();
    validate({ body: z.object({ n: z.coerce.number() }) })(request, mockRes(), next);
    expect(request.body).toEqual({ n: 5 });
    expect(next).toHaveBeenCalledWith();
  });

  it("forwards a 400 with flattened details", () => {
    const next = jest.fn();
    validate({ body: z.object({ n: z.number() }) })(req({ body: { n: "x" } }), mockRes(), next);
    const err = next.mock.calls[0][0] as AppError;
    expect(err.status).toBe(400);
    expect(err.details).toBeDefined();
  });

  it("validates params and query", () => {
    const request = req({ params: { id: "nope" } as never, query: {} });
    const next = jest.fn();
    validate({ params: z.object({ id: z.string().uuid() }) })(request, mockRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 400 });
  });
});

describe("errorHandler", () => {
  const run = (err: unknown) => {
    const res = mockRes();
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    errorHandler(err, req({}), res, jest.fn());
    spy.mockRestore();
    return res;
  };

  it("serialises AppError", () => {
    const res = run(AppError.notFound("nope"));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { code: "NOT_FOUND", message: "nope", details: undefined } });
  });

  it.each([
    ["P2002", 409],
    ["P2025", 404],
    ["P2003", 400]
  ])("maps Prisma %s to %i", (code, status) => {
    expect(run({ code }).status).toHaveBeenCalledWith(status);
  });

  it("maps malformed JSON to 400", () => {
    expect(run({ type: "entity.parse.failed" }).status).toHaveBeenCalledWith(400);
  });

  it("hides internals for unknown errors", () => {
    const res = run(new Error("db password leaked"));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("leaked");
  });
});

describe("notFoundHandler", () => {
  it("returns a 404 body", () => {
    const res = mockRes();
    notFoundHandler(req({ method: "GET", path: "/x" }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
