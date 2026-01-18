import { ConvexHttpClient } from "convex/browser";

// Create a Convex client for server-side use
export function getConvexClient(): ConvexHttpClient {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }

  return new ConvexHttpClient(convexUrl);
}

// Check if Convex is configured
export function isConvexConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CONVEX_URL;
}
