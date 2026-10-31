"use client";

import React from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh bg-[var(--station-dark)] flex items-center justify-center px-4">
      <div className="modal-card rounded-xl max-w-md w-full p-8 text-center">
        <div
          className="mta-bullet-lg mx-auto mb-4"
          style={{ backgroundColor: "var(--mta-red)", width: 48, height: 48, fontSize: 22 }}
          aria-hidden="true"
        >
          !
        </div>
        <h1
          className="text-white text-2xl mb-2"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          The wall hit a delay.
        </h1>
        <p className="text-white/50 text-sm leading-relaxed mb-6" style={{ fontFamily: "var(--font-body)" }}>
          Something went wrong while loading this page. Your note was not
          necessarily lost. Try again, or return to the wall.
        </p>
        {error.digest && (
          <p className="text-white/20 text-[10px] mb-4">Reference: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-[var(--mta-green)] text-white text-xs mta-button touch-target"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-white/10 bg-white/[0.05] text-white/70 text-xs mta-button touch-target"
          >
            Back to the wall
          </Link>
        </div>
      </div>
    </div>
  );
}
