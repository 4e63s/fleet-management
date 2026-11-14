import type { PrismaClient } from "@prisma/client";

/**
 * Lightweight Prisma double: every `prisma.<model>.<method>` is a lazily created
 * jest.fn(), and `$transaction` supports both the callback and the array form.
 * No database is needed, so unit and integration tests run anywhere.
 */
export function createPrismaMock(): PrismaClient {
  const models = new Map<string, unknown>();

  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return undefined;
        if (prop === "$transaction") {
          return jest.fn(async (arg: unknown) =>
            typeof arg === "function" ? (arg as (tx: unknown) => unknown)(proxy) : Promise.all(arg as Promise<unknown>[])
          );
        }
        if (prop === "$connect" || prop === "$disconnect") return jest.fn(async () => undefined);
        if (!models.has(prop)) {
          const fns: Record<string, jest.Mock> = {};
          models.set(
            prop,
            new Proxy(fns, {
              get(target, method: string) {
                if (method === "then") return undefined;
                if (!target[method]) target[method] = jest.fn();
                return target[method];
              }
            })
          );
        }
        return models.get(prop);
      }
    }
  );

  return proxy as PrismaClient;
}

/** Cast helper so tests can call mockResolvedValue & friends without noise. */
export const m = (fn: unknown) => fn as jest.Mock;
