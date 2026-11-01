import { getFunctionName } from "convex/server";
import type { FunctionReference } from "convex/server";

/**
 * Test doubles for the boundaries the app cannot run in a unit test:
 *
 * - The Next.js request scope behind `next/headers` (only exists inside a
 *   live Next server). `requestContext` stands in for it with real cookie and
 *   header stores, so session/abuse/admin-auth code runs unmodified.
 * - The hosted Convex deployment behind `convex/browser`. `convexBackend`
 *   records every call by its real function name ("notes:createNote") and
 *   answers with per-test handlers. Unhandled functions throw the same error
 *   a Convex deployment returns for a missing function.
 *
 * Everything else (storage, session, abuse, admin-auth, blob, moderation,
 * validation) runs for real in route tests.
 */

export interface SetCookieCall {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

let visitorCounter = 0;

export const requestContext = {
  cookies: new Map<string, string>(),
  headers: new Headers(),
  setCookies: [] as SetCookieCall[],
};

/**
 * Start a fresh anonymous visitor. Every test gets a distinct network
 * identity, so the module-level rate-limit and daily-limit maps in
 * abuse.ts/session.ts never leak state between tests.
 */
export function resetRequestContext(
  options: { cookies?: Record<string, string>; headers?: Record<string, string> } = {}
): void {
  visitorCounter += 1;
  requestContext.cookies = new Map(Object.entries(options.cookies ?? {}));
  requestContext.headers = new Headers({
    "x-forwarded-for": `198.51.100.${visitorCounter % 250}`,
    "user-agent": `vitest-visitor-${visitorCounter}`,
    ...(options.headers ?? {}),
  });
  requestContext.setCookies = [];
}

export function setRequestCookie(name: string, value: string): void {
  requestContext.cookies.set(name, value);
}

export function createCookieStore() {
  return {
    get(name: string) {
      const value = requestContext.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string, options?: Record<string, unknown>) {
      requestContext.cookies.set(name, value);
      requestContext.setCookies.push({ name, value, options });
    },
  };
}

export interface ConvexCall {
  kind: "query" | "mutation";
  name: string;
  args: Record<string, unknown>;
  url: string;
  adminKey: string | null;
}

type ConvexHandler = (args: Record<string, unknown>) => unknown;

export const convexBackend = {
  calls: [] as ConvexCall[],
  handlers: new Map<string, ConvexHandler>(),
  /** Answer `name` (e.g. "notes:createNote") with `handler`. */
  on(name: string, handler: ConvexHandler) {
    this.handlers.set(name, handler);
    return this;
  },
  callsTo(name: string): ConvexCall[] {
    return this.calls.filter((call) => call.name === name);
  },
  reset() {
    this.calls = [];
    this.handlers = new Map();
  },
};

export class FakeConvexHttpClient {
  readonly url: string;
  private adminKey: string | null = null;

  constructor(url: string) {
    this.url = url;
  }

  setAdminAuth(token: string): void {
    this.adminKey = token;
  }

  query(ref: unknown, args: Record<string, unknown> = {}): Promise<unknown> {
    return this.dispatch("query", ref, args);
  }

  mutation(ref: unknown, args: Record<string, unknown> = {}): Promise<unknown> {
    return this.dispatch("mutation", ref, args);
  }

  private async dispatch(
    kind: "query" | "mutation",
    ref: unknown,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const name = getFunctionName(ref as FunctionReference<"query" | "mutation">);
    convexBackend.calls.push({ kind, name, args, url: this.url, adminKey: this.adminKey });
    const handler = convexBackend.handlers.get(name);
    if (!handler) {
      throw new Error(`Could not find public function for '${name}'`);
    }
    return handler(args);
  }
}

/** Clear the dev/in-memory note store that src/lib/storage.ts keeps on globalThis. */
export function resetInMemoryStore(): void {
  const store = (
    globalThis as typeof globalThis & {
      __subwayTherapyStore?: {
        notes: Map<string, unknown>;
        flaggers: Map<string, unknown>;
        reactionKeys: Map<string, unknown>;
        flagReasons: Map<string, unknown>;
      };
    }
  ).__subwayTherapyStore;
  if (!store) return;
  store.notes.clear();
  store.flaggers.clear();
  store.reactionKeys.clear();
  store.flagReasons.clear();
}

/** Point the app at a (fake) Convex deployment for the current test. */
export function useConvex(options: { admin?: boolean } = {}): void {
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test-deployment.convex.cloud";
  if (options.admin ?? true) {
    process.env.CONVEX_DEPLOY_KEY = "test-deploy-key";
  } else {
    delete process.env.CONVEX_DEPLOY_KEY;
  }
}
