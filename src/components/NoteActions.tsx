"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  PublicStickyNote,
  REACTION_OPTIONS,
  ReactionCounts,
  ReactionKind,
  getReactionCounts,
  getReactionTotal,
} from "@/lib/types";
import { shareUrl, trackEvent, vibrate } from "@/lib/analytics";

interface NoteActionsProps {
  note: PublicStickyNote;
  onReport?: (noteId: string, reason?: string) => void | Promise<void>;
  onReactionUpdate?: (counts: ReactionCounts, total: number) => void;
  showOpenOnWall?: boolean;
  showReport?: boolean;
}

const REPORT_REASONS = [
  "Harassment or bullying",
  "Hate speech",
  "Threats or violence",
  "Personal information",
  "Spam or advertising",
  "Something else",
];

function shareTextForNote(note: PublicStickyNote): string {
  const text = note.text?.trim();
  if (text) {
    const clipped = text.length > 110 ? `${text.slice(0, 107)}…` : text;
    return `“${clipped}” — a note on Subway Therapy`;
  }
  return "A note on the Subway Therapy wall";
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}

export default function NoteActions({
  note,
  onReport,
  onReactionUpdate,
  showOpenOnWall = false,
  showReport = true,
}: NoteActionsProps) {
  const [counts, setCounts] = useState<ReactionCounts>(() =>
    getReactionCounts(note.reactionCounts)
  );
  const [total, setTotal] = useState(() => getReactionTotal(note));
  const [myReactions, setMyReactions] = useState<Set<ReactionKind>>(new Set());
  const [pendingKind, setPendingKind] = useState<ReactionKind | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  // Relative on the server, absolute after mount. Keeping the first client
  // render relative avoids a hydration mismatch in share hrefs.
  const [noteUrl, setNoteUrl] = useState(`/note/${note.id}`);
  const [showReportReasons, setShowReportReasons] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [isReporting, setIsReporting] = useState(false);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCounts(getReactionCounts(note.reactionCounts));
    setTotal(getReactionTotal(note));
  }, [note]);

  useEffect(() => {
    setMyReactions(new Set());
    setShowReportReasons(false);
    setNoteUrl(shareUrl(`/note/${note.id}`));
  }, [note.id]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const announce = useCallback((message: string) => {
    setShareStatus(message);
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(() => setShareStatus(null), 3200);
  }, []);

  const handleReaction = useCallback(
    async (kind: ReactionKind) => {
      if (pendingKind || myReactions.has(kind)) return;
      setPendingKind(kind);
      try {
        const response = await fetch(`/api/notes/${note.id}/react`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not react");

        const nextCounts = getReactionCounts(data.reactionCounts);
        const nextTotal =
          typeof data.reactionCount === "number"
            ? data.reactionCount
            : nextCounts.heart + nextCounts.hug + nextCounts.strength + nextCounts.metoo;
        setCounts(nextCounts);
        setTotal(nextTotal);
        setMyReactions((previous) => new Set(previous).add(kind));
        onReactionUpdate?.(nextCounts, nextTotal);
        vibrate(10);
        trackEvent("reaction_added", {
          noteId: note.id,
          reaction: kind,
          duplicate: Boolean(data.duplicate),
        });
      } catch {
        announce("Could not add that reaction. Try again.");
      } finally {
        setPendingKind(null);
      }
    },
    [announce, myReactions, note.id, onReactionUpdate, pendingKind]
  );

  const handleCopy = useCallback(async () => {
    const copied = await copyText(noteUrl);
    announce(copied ? "Link copied" : "Copy this link from your address bar");
    if (copied) {
      trackEvent("share_clicked", { noteId: note.id, channel: "copy" });
      vibrate(6);
    }
  }, [announce, note.id, noteUrl]);

  const handleNativeShare = useCallback(async () => {
    const url = noteUrl;
    const text = shareTextForNote(note);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Subway Therapy", text, url });
        trackEvent("share_clicked", { noteId: note.id, channel: "native" });
        vibrate(6);
        return;
      } catch {
        // User cancelled or the share sheet failed; fall back to copying.
      }
    }
    const copied = await copyText(`${text} ${url}`);
    announce(copied ? "Link copied" : "Share this note from your address bar");
    trackEvent("share_clicked", { noteId: note.id, channel: "copy_fallback" });
  }, [announce, note, noteUrl]);

  const handleReport = useCallback(async () => {
    if (!onReport || isReporting) return;
    setIsReporting(true);
    try {
      await onReport(note.id, reportReason);
      trackEvent("note_reported", { noteId: note.id, reason: reportReason });
      announce("Thanks. A moderator will review this note.");
      setShowReportReasons(false);
    } finally {
      setIsReporting(false);
    }
  }, [announce, isReporting, note.id, onReport, reportReason]);

  const encodedUrl = encodeURIComponent(noteUrl);
  const encodedText = encodeURIComponent(shareTextForNote(note));

  return (
    <div className="space-y-4">
      {/* Reactions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[11px] text-white/40 uppercase tracking-widest"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Send back
          </span>
          <span className="text-[11px] text-white/35" aria-live="polite">
            {total === 1 ? "1 reaction" : `${total} reactions`}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="React to this note">
          {REACTION_OPTIONS.map((option) => {
            const reacted = myReactions.has(option.kind);
            const count = counts[option.kind];
            return (
              <button
                key={option.kind}
                type="button"
                onClick={() => handleReaction(option.kind)}
                disabled={pendingKind !== null || reacted}
                aria-pressed={reacted}
                aria-label={`${option.label}${count ? `, ${count}` : ""}`}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-xs transition-colors touch-target ${
                  reacted
                    ? "border-[var(--mta-green)] bg-[var(--mta-green)]/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.07]"
                } disabled:opacity-60`}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {option.glyph}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  {option.shortLabel}
                </span>
                <span className="text-[10px] text-white/40">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Share */}
      <div>
        <span
          className="block text-[11px] text-white/40 uppercase tracking-widest mb-2"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          Pass it on
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleNativeShare}
            className="px-3 py-2 rounded-lg bg-[var(--mta-green)] text-white text-xs mta-button touch-target"
          >
            Share
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 hover:text-white text-xs mta-button touch-target"
          >
            Copy link
          </button>
          <a
            href={`/api/og?noteId=${note.id}&format=square`}
            target="_blank"
            rel="noreferrer"
            download={`subway-therapy-${note.id}.png`}
            onClick={() =>
              trackEvent("share_clicked", { noteId: note.id, channel: "card" })
            }
            className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 hover:text-white text-xs mta-button touch-target"
          >
            Save card
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("share_clicked", { noteId: note.id, channel: "x" })
            }
            className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 hover:text-white text-xs mta-button touch-target"
            aria-label="Share on X"
          >
            X
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `${shareTextForNote(note)} ${noteUrl}`
            )}`}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("share_clicked", { noteId: note.id, channel: "whatsapp" })
            }
            className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 hover:text-white text-xs mta-button touch-target"
            aria-label="Share on WhatsApp"
          >
            WhatsApp
          </a>
          {showOpenOnWall && (
            <a
              href={`/?x=${Math.round(note.x)}&y=${Math.round(note.y)}&z=1.25`}
              className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 hover:text-white text-xs mta-button touch-target"
            >
              Open on wall
            </a>
          )}
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {shareStatus}
        </p>
        {shareStatus && (
          <p className="text-[11px] text-[var(--mta-green)] mt-2" aria-hidden="true">
            {shareStatus}
          </p>
        )}
      </div>

      {/* Report */}
      {showReport && onReport && (
        <div className="pt-3 border-t border-white/10">
          {!showReportReasons ? (
            <button
              type="button"
              onClick={() => setShowReportReasons(true)}
              className="text-[11px] text-white/35 hover:text-white/70 underline underline-offset-2 transition-colors"
            >
              Report this note
            </button>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor={`report-reason-${note.id}`}
                className="block text-[11px] text-white/50"
              >
                What is wrong with this note?
              </label>
              <select
                id={`report-reason-${note.id}`}
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="w-full rounded-lg bg-white/[0.06] border border-white/10 text-white/80 text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--mta-green)]"
              >
                {REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason} className="bg-[#1E1E1E]">
                    {reason}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReport}
                  disabled={isReporting}
                  className="px-3 py-2 rounded-lg bg-[var(--mta-red)] text-white text-xs mta-button touch-target disabled:opacity-50"
                >
                  {isReporting ? "Sending..." : "Send report"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportReasons(false)}
                  className="px-3 py-2 rounded-lg text-white/50 hover:text-white text-xs mta-button touch-target"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
