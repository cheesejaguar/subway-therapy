import { ConvexHttpClient } from "convex/browser";

export interface ConvexAdminClient {
  query<TResult>(queryRef: unknown, args: Record<string, unknown>): Promise<TResult>;
  mutation<TResult>(mutationRef: unknown, args: Record<string, unknown>): Promise<TResult>;
}

function getConvexUrl(): string {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }

  return convexUrl;
}

// Create a Convex client for public server-side queries.
export function getConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(getConvexUrl());
}

// Create a Convex admin client for internal functions.
export function getConvexAdminClient(): ConvexAdminClient {
  const deployKey = process.env.CONVEX_DEPLOY_KEY;
  if (!deployKey) {
    throw new Error("CONVEX_DEPLOY_KEY is not set");
  }

  const client = new ConvexHttpClient(getConvexUrl());

  // `setAdminAuth` is intentionally undocumented in bundled typings, but is available at runtime.
  const adminClient = client as ConvexHttpClient & {
    setAdminAuth: (token: string) => void;
  };
  adminClient.setAdminAuth(deployKey);
  return client as unknown as ConvexAdminClient;
}

// Check if Convex is configured
export function isConvexConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CONVEX_URL;
}

export function isConvexAdminConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CONVEX_URL && !!process.env.CONVEX_DEPLOY_KEY;
}
