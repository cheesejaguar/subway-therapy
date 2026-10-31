import React from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/gallery", label: "Gallery" },
  { href: "/host", label: "Host a Wall" },
  { href: "/about", label: "About" },
  { href: "/guidelines", label: "Guidelines" },
];

export default function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-40 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 flex-shrink-0 group"
          aria-label="Subway Therapy home"
        >
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] mta-button"
            style={{ backgroundColor: "var(--mta-green)" }}
            aria-hidden="true"
          >
            ST
          </span>
          <span
            className="text-white text-sm sm:text-base uppercase tracking-[0.12em] group-hover:text-white/80 transition-colors"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Subway Therapy
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 overflow-x-auto" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-2.5 py-2 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.06] text-xs sm:text-sm whitespace-nowrap transition-colors"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/"
            className="ml-1 px-3 py-2 rounded-lg bg-[var(--mta-green)] text-white text-xs sm:text-sm mta-button whitespace-nowrap"
          >
            Leave a note
          </Link>
        </nav>
      </div>
    </header>
  );
}
