"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Wall, { WallCamera, WallFocusRequest } from "@/components/Wall";
import NoteCreator from "@/components/NoteCreator";
import NoteDetailModal from "@/components/NoteDetailModal";
import WelcomeCard from "@/components/WelcomeCard";
import WallMenu from "@/components/WallMenu";
import AccessibleWallList from "@/components/AccessibleWallList";
import {
  PendingNoteDraft,
  PublicStickyNote,
  ReactionCounts,
  ViewportBounds,
} from "@/lib/types";
import { ViewState } from "@/lib/viewport";
import {
  mergeNotesIntoCache,
  pruneCacheAround,
  tileRangeForBounds,
  tileToBounds,
} from "@/lib/noteCache";
import { shareUrl, trackEvent, vibrate } from "@/lib/analytics";
import { useAmbientSound } from "@/lib/useAmbientSound";

const WELCOME_STORAGE_KEY = "subway_therapy_welcome_v2";

// How long a fetched tile is considered fresh on the client. Matches the
// spirit of the CDN's s-maxage=30: panning around does not re-request tiles
// the user just saw.
const TILE_TTL_MS = 60_000;
const LIVE_REFRESH_MS = 60_000;
const STATS_REFRESH_MS = 30_000;

interface WallStats {
  total: number;
  today: number;
  reactions: number;
  countries: number;
}

interface Toast {
  kind: "success" | "error";
  text: string;
}

interface WallExperienceProps {
  initialNotes: PublicStickyNote[];
  initialStats: WallStats | null;
  initialCamera?: WallCamera;
}

function StatusBanner({
  role,
  children,
}: {
  role: "status" | "alert";
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed top-4 left-1/2 station-chrome rounded-lg px-4 sm:px-5 py-3 z-40 flex items-center gap-3 w-max max-w-[calc(100vw-6.5rem)]"
      style={{ animation: "slideDown 0.3s ease", transform: "translate(-50%, 0)" }}
      role={role}
      aria-live={role === "status" ? "polite" : undefined}
    >
      {children}
    </div>
  );
}

export default function WallExperience({
  initialNotes,
  initialStats,
  initialCamera,
}: WallExperienceProps) {
  const [notes, setNotes] = useState<PublicStickyNote[]>(initialNotes);
  const [isLoading, setIsLoading] = useState(initialNotes.length === 0);
  const [viewportReady, setViewportReady] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [canPost, setCanPost] = useState(true);
  const [cantPostReason, setCantPostReason] = useState<string>();
  const [timeUntilNextPost, setTimeUntilNextPost] = useState<string>();
  const [toast, setToast] = useState<Toast | null>(null);
  const [selectedNote, setSelectedNote] = useState<PublicStickyNote | null>(null);
  const [pendingNote, setPendingNote] = useState<PendingNoteDraft | null>(null);
  const [isPlacingNote, setIsPlacingNote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState<WallStats | null>(initialStats);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<WallFocusRequest | null>(null);
  const { enabled: ambientEnabled, toggle: toggleAmbient } = useAmbientSound();

  // Client-side note cache, merged across tile fetches so notes never vanish
  // (or replay their appear animation) while panning.
  const notesCacheRef = useRef(new Map(initialNotes.map((note) => [note.id, note])));
  const tileFetchedAtRef = useRef(new Map<number, number>());
  const inflightRef = useRef(new Map<number, AbortController>());
  const lastBoundsRef = useRef<ViewportBounds | null>(null);
  const lastViewRef = useRef<ViewState>({ x: 0, y: 0, zoom: 1 });
  // Synchronous double-submit guard (state updates are async, so a fast
  // double click/tap could otherwise POST twice).
  const submittingRef = useRef(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((kind: Toast["kind"], text: string) => {
    setToast({ kind, text });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 5600);
  }, []);

  // First-visit story card. It is dismissible and never blocks the wall.
  useEffect(() => {
    try {
      if (!localStorage.getItem(WELCOME_STORAGE_KEY)) {
        setShowWelcome(true);
      }
    } catch {
      // Storage can be unavailable in private modes; the wall still works.
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

  const recomputeViewportReady = useCallback(() => {
    const bounds = lastBoundsRef.current;
    if (!bounds) return;
    setViewportReady(
      tileRangeForBounds(bounds).every((tile) =>
        tileFetchedAtRef.current.has(tile)
      )
    );
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
        recomputeViewportReady();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Error fetching notes:", error);
        setIsLoading(false);
        setFetchError(true);
      } finally {
        inflightRef.current.delete(tile);
      }
    },
    [publishCache, recomputeViewportReady]
  );

  const handleViewportChange = useCallback(
    (bounds: ViewportBounds, view: ViewState) => {
      lastBoundsRef.current = bounds;
      lastViewRef.current = view;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      for (const tile of tileRangeForBounds(bounds)) {
        void fetchTile(tile, centerX);
      }
      recomputeViewportReady();

      // Keep the camera in the URL so any view is shareable and reloadable.
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("x", String(Math.round(centerX)));
        url.searchParams.set("y", String(Math.round((bounds.minY + bounds.maxY) / 2)));
        url.searchParams.set("z", view.zoom.toFixed(2));
        window.history.replaceState(null, "", url.toString());
      } catch {
        // History can be unavailable in embedded contexts.
      }
    },
    [fetchTile, recomputeViewportReady]
  );

  const handleRetryFetch = useCallback(() => {
    setFetchError(false);
    const bounds = lastBoundsRef.current;
    if (!bounds) return;
    for (const tile of tileRangeForBounds(bounds)) {
      tileFetchedAtRef.current.delete(tile);
    }
    handleViewportChange(bounds, lastViewRef.current);
  }, [handleViewportChange]);

  const refreshStats = useCallback(async () => {
    try {
      const response = await fetch("/api/stats");
      if (!response.ok) return;
      const data = await response.json();
      if (data?.stats) setStats(data.stats);
    } catch {
      // Stats are decorative; never interrupt the wall for them.
    }
  }, []);

  // Live wall: refresh the visible slice on a slow cadence, and keep the HUD
  // honest. Hidden tabs do not poll.
  useEffect(() => {
    if (!initialStats) void refreshStats();
    const statsTimer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshStats();
    }, STATS_REFRESH_MS);
    const tileTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const bounds = lastBoundsRef.current;
      if (!bounds) return;
      for (const tile of tileRangeForBounds(bounds)) {
        tileFetchedAtRef.current.delete(tile);
      }
      handleViewportChange(bounds, lastViewRef.current);
    }, LIVE_REFRESH_MS);
    return () => {
      clearInterval(statsTimer);
      clearInterval(tileTimer);
    };
  }, [handleViewportChange, initialStats, refreshStats]);

  const handleNoteClick = useCallback((note: PublicStickyNote) => {
    setSelectedNote(note);
    trackEvent("note_opened", { noteId: note.id });
  }, []);

  const handleReactionUpdate = useCallback(
    (noteId: string, counts: ReactionCounts, total: number) => {
      const existing = notesCacheRef.current.get(noteId);
      if (!existing) return;
      const updated = { ...existing, reactionCounts: counts, reactionCount: total };
      notesCacheRef.current.set(noteId, updated);
      setNotes(Array.from(notesCacheRef.current.values()));
      setSelectedNote((current) => (current?.id === noteId ? updated : current));
    },
    []
  );

  const handleFlagNote = useCallback(
    async (noteId: string, reason?: string) => {
      setSelectedNote(null);
      try {
        const response = await fetch("/api/notes/flag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteId, reason }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to report note");
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

  const handlePreparePlace = useCallback((draft: PendingNoteDraft) => {
    setPendingNote(draft);
    setShowCreator(false);
    setIsPlacingNote(true);
    trackEvent("note_placement_started", { kind: draft.kind });
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
            kind: pendingNote.kind,
            color: pendingNote.color,
            x,
            y,
            text: pendingNote.text,
            imageData: pendingNote.imageData,
            altText: pendingNote.altText,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to submit note");

        const wasRejected = data.note?.moderationStatus === "rejected";

        if (wasRejected) {
          // A rejected note must not burn the daily ritual.
          setCanPost(true);
          setCantPostReason(undefined);
          showToast(
            "error",
            data.message || "That note could not be posted. Please try a different message."
          );
          trackEvent("note_rejected", { kind: pendingNote.kind });
        } else {
          setCanPost(false);
          setCantPostReason("Only one note per person per day!");
          setTimeUntilNextPost(undefined);

          if (data.note?.id) {
            notesCacheRef.current.set(data.note.id, data.note as PublicStickyNote);
            setNotes(Array.from(notesCacheRef.current.values()));
          }
          if (data.note?.moderationStatus === "approved") {
            setStats((current) =>
              current
                ? { ...current, total: current.total + 1, today: current.today + 1 }
                : current
            );
          }
          vibrate(14);
          trackEvent("note_created", {
            kind: pendingNote.kind,
            status: data.note?.moderationStatus ?? "pending",
          });
          showToast("success", data.message);
        }

        setPendingNote(null);
        setIsPlacingNote(false);
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

  const handleDismissWelcome = useCallback(() => {
    try {
      localStorage.setItem(WELCOME_STORAGE_KEY, "true");
    } catch {
      // Ignore storage failures.
    }
    setShowWelcome(false);
  }, []);

  const handleStartFromWelcome = useCallback(() => {
    handleDismissWelcome();
    setShowCreator(true);
  }, [handleDismissWelcome]);

  const handleWander = useCallback(async () => {
    setIsMenuOpen(false);
    try {
      const response = await fetch("/api/notes/random");
      if (!response.ok) {
        showToast("error", "No notes to wander to yet. Be the first.");
        return;
      }
      const data = await response.json();
      const note = data?.note as PublicStickyNote | null;
      if (!note) {
        showToast("error", "No notes to wander to yet. Be the first.");
        return;
      }
      setFocusRequest({
        x: note.x + 75,
        y: note.y + 75,
        zoom: 1.35,
        key: Date.now(),
      });
      setSelectedNote(note);
      vibrate(8);
      trackEvent("wander_arrived", { noteId: note.id });
    } catch {
      showToast("error", "Could not find a note right now. Try again.");
    }
  }, [showToast]);

  const handleShowOnWall = useCallback((note: PublicStickyNote) => {
    setIsListOpen(false);
    setFocusRequest({
      x: note.x + 75,
      y: note.y + 75,
      zoom: 1.4,
      key: Date.now(),
    });
  }, []);

  const handleShareWall = useCallback(async () => {
    setIsMenuOpen(false);
    const url = shareUrl("/");
    const text = "A virtual wall for what we carry. Leave a note.";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Subway Therapy", text, url });
        trackEvent("share_clicked", { channel: "wall_native" });
        return;
      } catch {
        // Fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("success", "Wall link copied.");
      trackEvent("share_clicked", { channel: "wall_copy" });
    } catch {
      showToast("error", "Could not copy the link. You can copy it from the address bar.");
    }
  }, [showToast]);

  const handleToggleAmbient = useCallback(async () => {
    const started = await toggleAmbient();
    if (!started && !ambientEnabled) {
      showToast("error", "Ambient sound is not available in this browser.");
    }
  }, [ambientEnabled, showToast, toggleAmbient]);

  return (
    <div className="wall-page relative w-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white text-black px-4 py-2 rounded shadow z-50"
      >
        Skip to main content
      </a>

      <Wall
        notes={notes}
        onNoteClick={handleNoteClick}
        onViewportChange={handleViewportChange}
        isLoading={isLoading}
        isViewportReady={viewportReady}
        isPlacingNote={isPlacingNote}
        pendingNote={pendingNote}
        onPlaceNote={handlePlaceNote}
        onCancelPlacement={handleCancelPlacement}
        initialCamera={initialCamera}
        focusRequest={focusRequest}
      />

      {/* Live HUD — hidden on narrow screens to protect the wall */}
      {stats && (
        <div
          className="fixed top-4 right-[4.5rem] z-20 station-chrome rounded-full px-3 py-1.5 hidden sm:flex items-center gap-2"
          aria-label={`${stats.total} notes, ${stats.today} posted today, ${stats.reactions} reactions`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--mta-green)] animate-pulse" aria-hidden="true" />
          <span
            className="text-white/45 text-[10px] uppercase tracking-[0.16em]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Live
          </span>
          <span className="text-white/30 text-[10px]" aria-hidden="true">·</span>
          <span className="text-white/60 text-[11px]" style={{ fontFamily: "var(--font-body)" }}>
            {stats.total.toLocaleString()} notes
          </span>
          <span className="text-white/30 text-[10px]" aria-hidden="true">·</span>
          <span className="text-white/60 text-[11px]" style={{ fontFamily: "var(--font-body)" }}>
            {stats.today} today
          </span>
        </div>
      )}

      {/* Menu button — also the wall's wordmark */}
      <button
        type="button"
        onClick={() => setIsMenuOpen((open) => !open)}
        className="fixed top-4 right-4 z-40 w-11 h-11 rounded-full flex items-center justify-center text-white mta-button shadow-lg touch-target"
        style={{ backgroundColor: "var(--mta-green)" }}
        aria-label="Open wall menu"
        aria-expanded={isMenuOpen}
      >
        <span className="text-[13px] tracking-tight" aria-hidden="true">ST</span>
      </button>

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
        <StatusBanner role="alert">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--mta-red)" }} />
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
        </StatusBanner>
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
        <StatusBanner role="status">
          <div
            className="flex items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0"
            style={{
              width: 20,
              height: 20,
              backgroundColor: toast.kind === "success" ? "var(--mta-green)" : "var(--mta-red)",
            }}
          >
            {toast.kind === "success" ? "✓" : "!"}
          </div>
          <span className="text-white/90 text-sm" style={{ fontFamily: "var(--font-body)" }}>
            {toast.text}
          </span>
        </StatusBanner>
      )}

      <NoteDetailModal
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onReport={handleFlagNote}
        onReactionUpdate={handleReactionUpdate}
      />

      {showCreator && (
        <NoteCreator
          onClose={() => setShowCreator(false)}
          onPreparePlace={handlePreparePlace}
          canPost={canPost}
          cantPostReason={cantPostReason}
          timeUntilNextPost={timeUntilNextPost}
        />
      )}

      {showWelcome && !showCreator && !selectedNote && (
        <WelcomeCard
          onDismiss={handleDismissWelcome}
          onStart={handleStartFromWelcome}
        />
      )}

      <WallMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onWander={handleWander}
        onShare={handleShareWall}
        onOpenList={() => setIsListOpen(true)}
        ambientEnabled={ambientEnabled}
        onToggleAmbient={handleToggleAmbient}
        stats={stats}
      />

      <AccessibleWallList
        isOpen={isListOpen}
        notes={notes}
        onClose={() => setIsListOpen(false)}
        onShowOnWall={handleShowOnWall}
      />

      <div className="sr-only" role="status" aria-live="polite">
        {isLoading ? "Loading notes..." : `${notes.length} notes loaded`}
      </div>
    </div>
  );
}
