import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";
import {
  convexBackend,
  resetInMemoryStore,
  resetRequestContext,
} from "./fakes";

// next/headers only works inside a live Next request scope. Back it with a
// real per-test cookie/header store (see ./fakes) instead of bare vi.fn()s.
vi.mock("next/headers", async () => {
  const fakes = await import("./fakes");
  return {
    cookies: vi.fn(async () => fakes.createCookieStore()),
    headers: vi.fn(async () => fakes.requestContext.headers),
  };
});

// Vercel Blob is a paid third-party storage API.
vi.mock("@vercel/blob", () => ({
  put: vi.fn((pathname: string) =>
    Promise.resolve({ url: `https://blob.test/${pathname}` })
  ),
  del: vi.fn(() => Promise.resolve()),
}));

// Convex is a hosted database reached over HTTP. The fake client records
// calls by their real Convex function name (see ./fakes).
vi.mock("convex/browser", async () => {
  const fakes = await import("./fakes");
  return { ConvexHttpClient: fakes.FakeConvexHttpClient };
});

// Mock environment variables
vi.stubEnv("NODE_ENV", "test");

// External services are opt-in per test. Start every test in local dev mode:
// no Convex, no Blob token, no AI gateway, no admin key.
const SERVICE_ENV_KEYS = [
  "NEXT_PUBLIC_CONVEX_URL",
  "CONVEX_DEPLOY_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "AI_GATEWAY_API_KEY",
  "ADMIN_API_KEY",
  "ADMIN_SESSION_SECRET",
  "RATE_LIMIT_SECRET",
];

beforeEach(() => {
  for (const key of SERVICE_ENV_KEYS) {
    delete process.env[key];
  }
  resetRequestContext();
  resetInMemoryStore();
  convexBackend.reset();
});
