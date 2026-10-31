import React from "react";
import Link from "next/link";

const COLUMNS = [
  {
    title: "The wall",
    links: [
      { href: "/", label: "Leave a note" },
      { href: "/gallery", label: "Gallery" },
      { href: "/host", label: "Host a Wall" },
    ],
  },
  {
    title: "The project",
    links: [
      { href: "/about", label: "About" },
      { href: "/press", label: "Press" },
      { href: "/accessibility", label: "Accessibility" },
    ],
  },
  {
    title: "The fine print",
    links: [
      { href: "/guidelines", label: "Community guidelines" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer border-t border-white/10 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-3" aria-label="Subway Therapy home">
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] mta-button"
                style={{ backgroundColor: "var(--mta-green)" }}
                aria-hidden="true"
              >
                ST
              </span>
              <span
                className="text-white text-sm uppercase tracking-[0.12em]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
              >
                Subway Therapy
              </span>
            </Link>
            <p className="text-white/40 text-xs leading-relaxed max-w-xs" style={{ fontFamily: "var(--font-body)" }}>
              A virtual continuation of the Subway Therapy project, founded by
              Matthew Chavez in New York City in 2016.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2
                className="text-white/40 text-[11px] uppercase tracking-[0.16em] mb-3"
                style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
              >
                {column.title}
              </h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-white/60 hover:text-white text-xs transition-colors"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <p className="text-white/30 text-[11px] leading-relaxed max-w-2xl" style={{ fontFamily: "var(--font-body)" }}>
            © {year} Subway Therapy. An independent, authorized tribute to the
            original project by Matthew Chavez. Not affiliated with, endorsed by,
            or sponsored by the Metropolitan Transportation Authority (MTA) or any
            transit agency. “MTA” and subway line marks belong to their owners.
          </p>
          <p className="text-white/25 text-[11px] whitespace-nowrap" style={{ fontFamily: "var(--font-body)" }}>
            Made for the next person.
          </p>
        </div>
      </div>
    </footer>
  );
}
