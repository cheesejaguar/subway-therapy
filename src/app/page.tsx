"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Wall from "@/components/Wall";
import NoteCreator from "@/components/NoteCreator";
import OnboardingPopup from "@/components/OnboardingPopup";
import NoteDetailModal from "@/components/NoteDetailModal";
import { NoteColor, PublicStickyNote, ViewportBounds } from "@/lib/types";
import {
  mergeNotesIntoCache,
  pruneCacheAround,
  tileRangeForBounds,
  tileToBounds,
} from "@/lib/noteCache";

const ONBOARDING_STORAGE_KEY = "subway_therapy_onboarded";

// How long a fetched tile is considered fresh on the client. Matches the
// spirit of the CDN's s-maxage=30: panning around does not re-request tiles
// the user just saw.
const TILE_TTL_MS = 60_000;

interface PendingNote {
  imageData: string;
  color: NoteColor;
}

interface Toast {
  kind: "success" | "error";
  text: string;
}

export default function Home() {
  const [notes, setNotes] = useState<PublicStickyNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [canPost, setCanPost] = useState(true);
  const [cantPostReason, setCantPostReason] = useState<string>();
  const [timeUntilNextPost, setTimeUntilNextPost] = useState<string>();
  const [toast, setToast] = useState<Toast | null>(null);
  const [selectedNote, setSelectedNote] = useState<PublicStickyNote | null>(null);
  const [pendingNote, setPendingNote] = useState<PendingNote | null>(null);
  const [isPlacingNote, setIsPlacingNote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client-side note cache, merged across tile fetches so notes never vanish
  // (or replay their appear animation) while panning.
  const notesCacheRef = useRef(new Map<string, PublicStickyNote>());
  const tileFetchedAtRef = useRef(new Map<number, number>());
  const inflightRef = useRef(new Map<number, AbortController>());
  const lastBoundsRef = useRef<ViewportBounds | null>(null);
  // Synchronous double-submit guard (state updates are async, so a fast
  // double click/tap could otherwise POST twice).
  const submittingRef = useRef(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((kind: Toast["kind"], text: string) => {
    setToast({ kind, text });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Check onboarding status
  useEffect(() => {
    const hasOnboarded = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!hasOnboarded) {
      setShowOnboarding(true);
    }
  }, []);

  // Check session status
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/session");
        if (!response.ok) return;

        const data = await response.json();
        setCanPost(data.canPost);
        setCantPostReason(data.reason);
        setTimeUntilNextPost(data.timeUntilNextPost);
      } catch (error) {
        console.error("Error checking session:", error);
      }
    };
    checkSession();
  }, []);

  // Abort in-flight fetches and clear timers on unmount.
  useEffect(() => {
    const inflight = inflightRef.current;
    const toastTimeout = toastTimeoutRef;
    return () => {
      for (const controller of inflight.values()) controller.abort();
      inflight.clear();
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  const publishCache = useCallback((centerX: number) => {
    pruneCacheAround(notesCacheRef.current, centerX);
    setNotes(Array.from(notesCacheRef.current.values()));
  }, []);

  const fetchTile = useCallback(
    async (tile: number, viewportCenterX: number) => {
      if (inflightRef.current.has(tile)) return;

      const fetchedAt = tileFetchedAtRef.current.get(tile);
      if (fetchedAt !== undefined && Date.now() - fetchedAt < TILE_TTL_MS) return;

      const tileBounds = tileToBounds(tile);
      // Integer, tile-aligned params: the same URLs repeat across pans and
      // users, so the CDN can actually cache them.
      const params = new URLSearchParams({
        minX: String(tileBounds.minX),
        maxX: String(tileBounds.maxX),
        minY: String(tileBounds.minY),
        maxY: String(tileBounds.maxY),
      });

      const controller = new AbortController();
      inflightRef.current.set(tile, controller);

      try {
        const response = await fetch(`/api/notes?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to fetch notes");

        const data = await response.json();
        if (!Array.isArray(data?.notes)) throw new Error("Malformed response");

        mergeNotesIntoCache(notesCacheRef.current, data.notes, tileBounds);
        tileFetchedAtRef.current.set(tile, Date.now());
        setFetchError(false);
        setIsLoading(false);
        publishCache(viewportCenterX);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Error fetching notes:", error);
        setIsLoading(false);
        setFetchError(true);
      } finally {
        inflightRef.current.delete(tile);
      }
    },
    [publishCache]
  );

  const handleViewportChange = useCallback(
    (bounds: ViewportBounds) => {
      lastBoundsRef.current = bounds;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      for (const tile of tileRangeForBounds(bounds)) {
        void fetchTile(tile, centerX);
      }
    },
    [fetchTile]
  );

  const handleRetryFetch = useCallback(() => {
    setFetchError(false);
    const bounds = lastBoundsRef.current;
    if (!bounds) return;
    for (const tile of tileRangeForBounds(bounds)) {
      tileFetchedAtRef.current.delete(tile);
    }
    handleViewportChange(bounds);
  }, [handleViewportChange]);

  const handleNoteClick = useCallback((note: PublicStickyNote) => {
    setSelectedNote(note);
  }, []);

  const handleFlagNote = useCallback(
    async (noteId: string) => {
      setSelectedNote(null);
      try {
        const response = await fetch("/api/notes/flag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteId }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to report note");
        }

        showToast("success", data.message);
      } catch (error) {
        console.error("Error flagging note:", error);
        showToast(
          "error",
          error instanceof Error ? error.message : "Failed to report note. Please try again."
        );
      }
    },
    [showToast]
  );

  const handlePreparePlace = useCallback((imageData: string, color: NoteColor) => {
    setPendingNote({ imageData, color });
    setShowCreator(false);
    setIsPlacingNote(true);
  }, []);

  const handleCancelPlacement = useCallback(() => {
    setPendingNote(null);
    setIsPlacingNote(false);
  }, []);

  const handlePlaceNote = useCallback(
    async (x: number, y: number) => {
      if (!pendingNote || submittingRef.current) return;
      submittingRef.current = true;
      setIsSubmitting(true);

      try {
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageData: pendingNote.imageData,
            color: pendingNote.color,
            x,
            y,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to submit note");
        }

        setPendingNote(null);
        setIsPlacingNote(false);
        setCanPost(false);
        setCantPostReason("Only one note per person per day!");

        // Public GETs are CDN-cached for a short window, so insert the
        // poster's own note directly — it appears instantly for them.
        if (data.note?.moderationStatus === "approved" && data.note.imageUrl) {
          notesCacheRef.current.set(data.note.id, data.note as PublicStickyNote);
          setNotes(Array.from(notesCacheRef.current.values()));
        }

        showToast("success", data.message);
      } catch (error) {
        console.error("Error submitting note:", error);
        showToast(
          "error",
          error instanceof Error ? error.message : "Failed to submit note"
        );
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [pendingNote, showToast]
  );

  const handleCloseOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setShowOnboarding(false);
  }, []);

  return (
    <div className="wall-page relative w-screen">
      {/* Accessibility skip link — first focusable element on the page */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white text-black px-4 py-2 rounded shadow z-50"
      >
        Skip to main content
      </a>

      {/* Main wall */}
      <Wall
        notes={notes}
        onNoteClick={handleNoteClick}
        onViewportChange={handleViewportChange}
        isLoading={isLoading}
        isPlacingNote={isPlacingNote}
        pendingNote={pendingNote}
        onPlaceNote={handlePlaceNote}
        onCancelPlacement={handleCancelPlacement}
      />

      {/* Add note button — MTA-styled floating action */}
      {!isPlacingNote && (
        <button
          onClick={() => setShowCreator(true)}
          className="fixed left-1/2 -translate-x-1/2 mta-button px-8 py-3.5 bg-[var(--ui-primary)] text-white text-base rounded-full shadow-lg hover:bg-[var(--ui-primary-hover)] focus:ring-4 focus:ring-[var(--mta-yellow)]/50 touch-target z-30"
          style={{
            bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
            animation: "pulse-glow 2.5s ease-in-out infinite",
            fontFamily: "var(--font-display)",
            fontSize: "15px",
          }}
          aria-label="Add your note"
        >
          ADD YOUR NOTE
        </button>
      )}

      {/* Fetch error banner with retry */}
      {fetchError && (
        <div
          className="fixed top-4 left-1/2 station-chrome rounded-lg px-5 py-3 z-40 flex items-center gap-3"
          style={{ animation: "slideDown 0.3s ease", transform: "translate(-50%, 0)" }}
          role="alert"
        >
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: "var(--mta-red)" }}
          />
          <span className="text-white/90 text-sm" style={{ fontFamily: "var(--font-body)" }}>
            Could not load notes.
          </span>
          <button
            onClick={handleRetryFetch}
            className="px-3 py-1 text-xs text-white hover:bg-white/10 rounded transition-colors tracking-wider uppercase"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600, backgroundColor: "var(--mta-red)" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Submitting overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50">
          <div className="station-chrome rounded-lg px-6 py-4 flex items-center gap-3" style={{ animation: "fadeIn 0.2s ease" }}>
            <div className="w-5 h-5 border-2 border-[var(--mta-green)] border-t-transparent rounded-full animate-spin" />
            <span className="text-white/90" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
              POSTING YOUR NOTE...
            </span>
          </div>
        </div>
      )}

      {/* Toast — MTA-style banner for success and error feedback */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 station-chrome rounded-lg px-5 py-3 z-40 flex items-center gap-3"
          style={{ animation: "slideDown 0.3s ease", transform: "translate(-50%, 0)" }}
          role="status"
          aria-live="polite"
        >
          <div
            className="flex items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0"
            style={{
              width: 20,
              height: 20,
              backgroundColor:
                toast.kind === "success" ? "var(--mta-green)" : "var(--mta-red)",
            }}
          >
            {toast.kind === "success" ? "✓" : "!"}
          </div>
          <span className="text-white/90 text-sm" style={{ fontFamily: "var(--font-body)" }}>
            {toast.text}
          </span>
        </div>
      )}

      {/* Note detail modal — larger view + accessible reporting */}
      <NoteDetailModal
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onReport={handleFlagNote}
      />

      {/* Note creator modal — mounted fresh on each open so all drawing
          state (canvas, hasDrawn, text) resets when it closes */}
      {showCreator && (
        <NoteCreator
          isOpen
          onClose={() => setShowCreator(false)}
          onPreparePlace={handlePreparePlace}
          canPost={canPost}
          cantPostReason={cantPostReason}
          timeUntilNextPost={timeUntilNextPost}
        />
      )}

      {/* Onboarding popup */}
      <OnboardingPopup
        isOpen={showOnboarding}
        onClose={handleCloseOnboarding}
      />

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {isLoading ? "Loading notes..." : `${notes.length} notes loaded`}
      </div>
    </div>
  );
}
