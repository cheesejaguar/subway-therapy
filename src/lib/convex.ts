import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

export interface ConvexAdminClient {
  query<TResult>(
    queryRef: FunctionReference<"query">,
    args: Record<string, unknown>
  ): Promise<TResult>;
  mutation<TResult>(
    mutationRef: FunctionReference<"mutation">,
    args: Record<string, unknown>
  ): Promise<TResult>;
}

function getConvexUrl(): string {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }

  return convexUrl;
}

function getServerSecret(): string {
  const secret = process.env.CONVEX_SERVER_SECRET;
  if (!secret) {
    throw new Error("CONVEX_SERVER_SECRET is not set");
  }
  return secret;
}

// Create a Convex client for public server-side queries.
export function getConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(getConvexUrl());
}

// Create a Convex client authorized for server-to-server calls.
// Privileged Convex functions validate the shared `serverSecret` argument
// against the `CONVEX_SERVER_SECRET` configured on the Convex deployment,
// so we inject it transparently on every call here.
export function getConvexAdminClient(): ConvexAdminClient {
  const serverSecret = getServerSecret();
  const client = new ConvexHttpClient(getConvexUrl());

  return {
    query: <TResult>(
      queryRef: FunctionReference<"query">,
      args: Record<string, unknown>
    ): Promise<TResult> => {
      return client.query(queryRef, { ...args, serverSecret }) as Promise<TResult>;
    },
    mutation: <TResult>(
      mutationRef: FunctionReference<"mutation">,
      args: Record<string, unknown>
    ): Promise<TResult> => {
      return client.mutation(mutationRef, { ...args, serverSecret }) as Promise<TResult>;
    },
  };
}

// Check if Convex is configured
export function isConvexConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CONVEX_URL;
}

export function isConvexAdminConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CONVEX_URL && !!process.env.CONVEX_SERVER_SECRET;
}
