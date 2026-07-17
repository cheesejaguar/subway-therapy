import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import {
  clearAdminSessionCookie,
  createAdminSessionToken,
  isAdminConfigured,
  isAdminPasswordValid,
  isAdminRequestAuthenticated,
  isSafeAdminOrigin,
  setAdminSessionCookie,
} from "@/lib/admin-auth";

function configurationErrorResponse() {
  return noStoreJson({ error: "Admin authentication is not configured" }, 503);
}

export async function GET(request: NextRequest) {
  if (!isAdminConfigured()) {
    return configurationErrorResponse();
  }

  return noStoreJson({
    authenticated: isAdminRequestAuthenticated(request),
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return configurationErrorResponse();
  }

  if (!isSafeAdminOrigin(request)) {
    return noStoreJson({ error: "Invalid request origin" }, 403);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid JSON body" }, 400);
  }

  const password = (payload as { password?: unknown })?.password;
  if (typeof password !== "string" || password.length === 0) {
    return noStoreJson({ error: "Password is required" }, 400);
  }

  if (!isAdminPasswordValid(password)) {
    return noStoreJson({ error: "Invalid password" }, 401);
  }

  const token = createAdminSessionToken();
  if (!token) {
    return configurationErrorResponse();
  }

  await setAdminSessionCookie(token);
  return noStoreJson({ success: true });
}

export async function DELETE(request: NextRequest) {
  if (!isAdminConfigured()) {
    return configurationErrorResponse();
  }

  if (!isSafeAdminOrigin(request)) {
    return noStoreJson({ error: "Invalid request origin" }, 403);
  }

  await clearAdminSessionCookie();
  return noStoreJson({ success: true });
}
