"use client";

import { track } from "@vercel/analytics";

type AnalyticsValue = string | number | boolean | null | undefined;

/**
 * Thin wrapper around Vercel Analytics custom events. Analytics is optional in
 * local development and blocked in some browsers, so tracking must never throw
 * or interrupt the interaction that triggered it.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, AnalyticsValue>
): void {
  try {
    track(name, properties);
  } catch {
    // Analytics must never break the wall.
  }
}

/** Best-effort haptic feedback for actions that change the wall. */
export function vibrate(pattern: number | number[] = 8): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Unsupported or blocked; motion is optional.
  }
}

export function shareUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}
