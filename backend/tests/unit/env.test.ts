import { loadEnv } from "../../src/config/env";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_ACCESS_SECRET: "x".repeat(32),
  DEVICE_API_KEY: "device-key-1234"
};

describe("loadEnv", () => {
  it("applies defaults", () => {
    const env = loadEnv(valid as unknown as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(4000);
    expect(env.ACCESS_TOKEN_TTL).toBe("15m");
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it("coerces numeric values", () => {
    const env = loadEnv({ ...valid, PORT: "8080" } as unknown as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(8080);
  });

  it("rejects a short JWT secret", () => {
    expect(() => loadEnv({ ...valid, JWT_ACCESS_SECRET: "short" } as unknown as NodeJS.ProcessEnv)).toThrow(
      /JWT_ACCESS_SECRET/
    );
  });

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => loadEnv(rest as unknown as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });
});
