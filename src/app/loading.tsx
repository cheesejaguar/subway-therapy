import React from "react";

export default function Loading() {
  return (
    <div className="min-h-dvh bg-[var(--station-dark)] flex items-center justify-center">
      <div className="station-chrome rounded-lg px-6 py-4 flex items-center gap-3" role="status" aria-live="polite">
        <div className="w-5 h-5 border-2 border-[var(--mta-green)] border-t-transparent rounded-full animate-spin" />
        <span
          className="text-white/80 text-sm tracking-wider uppercase"
          style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
        >
          Loading the wall...
        </span>
      </div>
    </div>
  );
}
