"use client";

import React from "react";
import { trackEvent } from "@/lib/analytics";

interface WelcomeCardProps {
  onDismiss: () => void;
  onStart: () => void;
}

/**
 * A first-visit welcome that does not take over the wall. The story is the
 * invitation; the wall stays visible and usable behind it.
 */
export default function WelcomeCard({ onDismiss, onStart }: WelcomeCardProps) {
  return (
    <aside
      className="fixed left-4 right-4 sm:right-auto z-30 station-chrome rounded-xl p-4 max-w-[min(340px,calc(100vw-2rem))]"
      style={{
        bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))",
        animation: "slideUp 0.45s ease",
      }}
      aria-labelledby="welcome-title"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="text-[10px] text-[var(--mta-yellow)] uppercase tracking-[0.18em]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          A note from the founder
        </span>
        <button
          type="button"
          onClick={() => {
            trackEvent("welcome_dismissed");
            onDismiss();
          }}
          className="text-white/35 hover:text-white text-lg leading-none -mt-1 touch-target"
          aria-label="Dismiss welcome"
        >
          &times;
        </button>
      </div>

      <h2
        id="welcome-title"
        className="text-white text-xl mt-2 leading-tight"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        This wall began underground.
      </h2>
      <p className="text-white/55 text-xs mt-2 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
        In 2016, Matthew Chavez set up a table in a New York subway station and
        invited strangers to write down what they were carrying. The notes became
        Subway Therapy. This is its virtual continuation: a place to leave
        something honest for the next person.
      </p>
      <p className="text-white/35 text-[11px] mt-2" style={{ fontFamily: "var(--font-body)" }}>
        Anonymous. Free. One note per person per day.
      </p>

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => {
            trackEvent("welcome_started");
            onStart();
          }}
          className="px-4 py-2 rounded-lg bg-[var(--mta-green)] text-white text-xs mta-button touch-target"
        >
          Leave a note
        </button>
        <a
          href="/about"
          className="px-3 py-2 rounded-lg text-white/55 hover:text-white text-xs mta-button touch-target"
        >
          Read the story
        </a>
      </div>
    </aside>
  );
}
