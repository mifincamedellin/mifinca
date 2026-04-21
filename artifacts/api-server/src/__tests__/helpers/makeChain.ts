import { vi } from "vitest";

/**
 * Creates a chainable, awaitable Drizzle-style query mock.
 * The chain itself is thenable (awaitable at any point in the chain),
 * and terminal methods like `.limit()` and `.returning()` return Promises.
 */
export function makeChain(resolveWith: unknown[]) {
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    set: vi.fn(() => chain),
    values: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(resolveWith)),
    returning: vi.fn(() => Promise.resolve(resolveWith)),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(resolveWith).then(res, rej),
    catch: (rej: (e: unknown) => unknown) =>
      Promise.resolve(resolveWith).catch(rej),
    finally: (fin: () => void) =>
      Promise.resolve(resolveWith).finally(fin),
  };
  return chain;
}
