import jwt from "jsonwebtoken";
import { AppError } from "../../src/lib/errors";
import { generateRefreshToken, hashToken, signAccessToken, verifyAccessToken } from "../../src/lib/tokens";

const SECRET = "unit-test-secret-unit-test-secret-123456";

describe("access tokens", () => {
  it("round-trips subject and role", () => {
    const token = signAccessToken({ sub: "user-1", role: "MANAGER" }, SECRET, "15m");
    expect(verifyAccessToken(token, SECRET)).toEqual({ sub: "user-1", role: "MANAGER" });
  });

  it("rejects a token signed with another secret", () => {
    const token = signAccessToken({ sub: "user-1", role: "ADMIN" }, "another-secret-another-secret-123456789", "15m");
    expect(() => verifyAccessToken(token, SECRET)).toThrow(AppError);
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ role: "ADMIN" }, SECRET, { subject: "user-1", expiresIn: -10 });
    expect(() => verifyAccessToken(expired, SECRET)).toThrow(/Invalid or expired/);
  });

  it("rejects a token without a role claim", () => {
    const token = jwt.sign({}, SECRET, { subject: "user-1" });
    expect(() => verifyAccessToken(token, SECRET)).toThrow(AppError);
  });

  it("rejects garbage", () => {
    expect(() => verifyAccessToken("not-a-jwt", SECRET)).toThrow(AppError);
  });
});

describe("refresh tokens", () => {
  it("generates unique 96-char hex tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).toMatch(/^[0-9a-f]{96}$/);
    expect(a).not.toBe(b);
  });

  it("hashes deterministically to sha256 hex", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});
