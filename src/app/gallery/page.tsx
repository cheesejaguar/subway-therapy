import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import NoteCard from "@/components/NoteCard";
import { getGalleryNotes, getWallStats } from "@/lib/note-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Browse notes from the Subway Therapy virtual wall: messages of hope, grief, love, and solidarity left by strangers around the world.",
  alternates: { canonical: "/gallery" },
  openGraph: {
    title: "The Subway Therapy gallery",
    description:
      "Browse notes from the virtual wall. Every square is something a stranger needed to say.",
    images: ["/api/og?format=wide"],
  },
};

interface GalleryProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GalleryPage({ searchParams }: GalleryProps) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim().slice(0, 120) || "";
  const before = firstValue(params.before);
  const limit = 48;

  const [notes, stats] = await Promise.all([
    getGalleryNotes({ query, limit, before }).catch((error) => {
      console.error("Error loading gallery:", error);
      return [];
    }),
    getWallStats().catch(() => null),
  ]);

  const hasOlder = !query && notes.length === limit;
  const oldest = notes[notes.length - 1];

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-2xl">
          <p
            className="text-[11px] uppercase tracking-[0.2em] text-[var(--mta-yellow)] mb-3"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            The wall, collected
          </p>
          <h1
            className="text-3xl sm:text-5xl text-white leading-[1.05]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Every note is a stranger
            <br />
            saying something true.
          </h1>
          <p className="text-white/50 text-sm sm:text-base mt-4 leading-relaxed max-w-xl" style={{ fontFamily: "var(--font-body)" }}>
            Browse the wall at your own pace. Search for a word, a feeling, or a
            phrase you remember. Open any note to react, share it, or find it on
            the wall.
          </p>
          {stats && (
            <p className="text-white/30 text-xs mt-4" style={{ fontFamily: "var(--font-body)" }}>
              {stats.total.toLocaleString()} notes · {stats.today} posted today ·{" "}
              {stats.reactions.toLocaleString()} reactions
            </p>
          )}
        </div>

        <form action="/gallery" method="get" className="mt-8 flex flex-col sm:flex-row gap-2 max-w-xl" role="search">
          <label htmlFor="gallery-search" className="sr-only">
            Search notes
          </label>
          <input
            id="gallery-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search what people wrote…"
            className="flex-1 rounded-lg bg-white/[0.05] border border-white/10 px-4 py-3 text-sm text-white/85 placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[var(--mta-green)]"
          />
          <button
            type="submit"
            className="px-5 py-3 rounded-lg bg-[var(--mta-green)] text-white text-sm mta-button touch-target"
          >
            Search
          </button>
          {query && (
            <a
              href="/gallery"
              className="px-4 py-3 rounded-lg text-white/50 hover:text-white text-sm text-center mta-button"
            >
              Clear
            </a>
          )}
        </form>

        {query && (
          <p className="text-white/40 text-xs mt-4" role="status">
            {notes.length === 0
              ? `No notes match “${query}”.`
              : `${notes.length} note${notes.length === 1 ? "" : "s"} matching “${query}”.`}
          </p>
        )}

        {notes.length === 0 ? (
          <div className="mt-12 rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <p
              className="text-white/70 text-lg mb-2"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              {query ? "No notes found" : "The gallery is waiting for its first note"}
            </p>
            <p className="text-white/40 text-sm mb-5" style={{ fontFamily: "var(--font-body)" }}>
              {query
                ? "Try a different word, or browse the newest notes."
                : "Leave something for the next person. It only takes a minute."}
            </p>
            <a
              href={query ? "/gallery" : "/"}
              className="inline-block px-5 py-2.5 rounded-lg bg-[var(--mta-green)] text-white text-sm mta-button"
            >
              {query ? "Browse the gallery" : "Leave a note"}
            </a>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {notes.map((note) => (
              <li key={note.id}>
                <NoteCard note={note} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-white/45 hover:text-white text-xs transition-colors"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            ← Back to the wall
          </Link>
          {hasOlder && oldest && (
            <a
              href={`/gallery?before=${encodeURIComponent(oldest.createdAt)}`}
              className="px-5 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white/70 hover:text-white text-xs mta-button"
            >
              Load older notes
            </a>
          )}
        </div>
      </div>
    </PageShell>
  );
}
