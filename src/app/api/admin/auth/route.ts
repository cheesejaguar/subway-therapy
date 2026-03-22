import { NextRequest, NextResponse } from "next/server";
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
  return NextResponse.json(
    { error: "Admin authentication is not configured" },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  if (!isAdminConfigured()) {
    return configurationErrorResponse();
  }

  return NextResponse.json({
    authenticated: isAdminRequestAuthenticated(request),
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return configurationErrorResponse();
  }

  if (!isSafeAdminOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const password = (payload as { password?: unknown })?.password;
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  if (!isAdminPasswordValid(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = createAdminSessionToken();
  if (!token) {
    return configurationErrorResponse();
  }

  await setAdminSessionCookie(token);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  if (!isAdminConfigured()) {
    return configurationErrorResponse();
  }

  if (!isSafeAdminOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  await clearAdminSessionCookie();
  return NextResponse.json({ success: true });
}
