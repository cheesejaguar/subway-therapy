import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, LAST_NOTE_COOKIE_NAME } from "./types";
import { v4 as uuidv4 } from "uuid";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * ONE_DAY_MS;

export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    sessionId = uuidv4();
  }

  return sessionId;
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_YEAR_MS / 1000, // in seconds
    path: "/",
  });
}

export async function canUserPostNote(): Promise<{
  canPost: boolean;
  reason?: string;
  timeUntilNextPost?: number;
}> {
  const cookieStore = await cookies();
  const lastNoteTime = cookieStore.get(LAST_NOTE_COOKIE_NAME)?.value;

  if (!lastNoteTime) {
    return { canPost: true };
  }

  const lastNoteDate = new Date(lastNoteTime);
  const now = new Date();
  const timeSinceLastNote = now.getTime() - lastNoteDate.getTime();

  if (timeSinceLastNote < ONE_DAY_MS) {
    const timeUntilNextPost = ONE_DAY_MS - timeSinceLastNote;
    return {
      canPost: false,
      reason: "Only one note per person per day!",
      timeUntilNextPost,
    };
  }

  return { canPost: true };
}

export async function recordNoteSubmission(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LAST_NOTE_COOKIE_NAME, new Date().toISOString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_DAY_MS / 1000,
    path: "/",
  });
}

export function formatTimeRemaining(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
