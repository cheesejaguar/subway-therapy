import React from "react";
import Link from "next/link";
import PageShell from "@/components/PageShell";

export default function NotFound() {
  return (
    <PageShell>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div
          className="mta-bullet-lg mx-auto mb-5"
          style={{ backgroundColor: "var(--mta-yellow)", color: "#1A1A1A", width: 52, height: 52, fontSize: 20 }}
          aria-hidden="true"
        >
          404
        </div>
        <h1
          className="text-white text-3xl sm:text-4xl mb-3"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          This note is not on the wall.
        </h1>
        <p className="text-white/50 text-sm leading-relaxed mb-7" style={{ fontFamily: "var(--font-body)" }}>
          It may have been removed, may still be in moderation, or the link may be
          incomplete. The wall is still here.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="px-5 py-2.5 rounded-lg bg-[var(--mta-green)] text-white text-xs mta-button">
            Back to the wall
          </Link>
          <a href="/gallery" className="px-5 py-2.5 rounded-lg border border-white/10 bg-white/[0.05] text-white/70 text-xs mta-button">
            Browse the gallery
          </a>
        </div>
      </div>
    </PageShell>
  );
}
