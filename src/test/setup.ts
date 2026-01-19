import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock next/headers cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

// Mock uuid
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-1234"),
}));

// Mock @vercel/blob
vi.mock("@vercel/blob", () => ({
  put: vi.fn(() => Promise.resolve({ url: "https://blob.test/notes/test.png" })),
  del: vi.fn(() => Promise.resolve()),
}));

// Mock convex
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(() => ({
    query: vi.fn(),
    mutation: vi.fn(),
  })),
}));

// Mock environment variables
vi.stubEnv("NODE_ENV", "test");
