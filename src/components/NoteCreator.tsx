"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  NoteColor,
  InkColor,
  NOTE_COLORS,
  INK_COLORS,
  PendingNoteDraft,
  DAILY_PROMPTS,
} from "@/lib/types";
import {
  getBase64ByteLength,
  MAX_IMAGE_BYTES,
  MAX_TEXT_LENGTH,
  MAX_CAPTION_LENGTH,
} from "@/lib/validation";
import { useModalDialog } from "./useModalDialog";
import { trackEvent } from "@/lib/analytics";

// The creator is mounted fresh each time it opens (see WallExperience), so all
// drawing state naturally resets when it closes.
interface NoteCreatorProps {
  onClose: () => void;
  onPreparePlace: (note: PendingNoteDraft) => void;
  canPost: boolean;
  cantPostReason?: string;
  timeUntilNextPost?: string;
}

type InputMode = "draw" | "text";

const NOTE_COLOR_OPTIONS: NoteColor[] = [
  "yellow",
  "pink",
  "blue",
  "green",
  "orange",
  "purple",
  "coral",
  "white",
];

const INK_COLOR_OPTIONS: InkColor[] = ["black", "blue", "red", "green", "purple"];

// Logical canvas size; the backing store is scaled by devicePixelRatio
// (capped at 2) for crisp strokes and exports.
const CANVAS_SIZE = 300;
// Client-side export guard, derived from the server's validation limit with
// headroom so a borderline image is never rejected server-side.
const MAX_EXPORT_BYTES = MAX_IMAGE_BYTES - 20_000;

function dataUrlByteLength(dataUrl: string): number {
  return getBase64ByteLength(dataUrl.slice(dataUrl.indexOf(",") + 1));
}

export default function NoteCreator({
  onClose,
  onPreparePlace,
  canPost,
  cantPostReason,
  timeUntilNextPost,
}: NoteCreatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Transparent offscreen layer holding only the user's strokes. The visible
  // canvas is always background fill + this layer composited, so changing
  // the note color never destroys the drawing.
  const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Frozen on first use: re-reading devicePixelRatio on later effect runs
  // would resize (and thereby wipe) the stroke layer mid-drawing.
  const scaleRef = useRef<number | null>(null);

  const [noteColor, setNoteColor] = useState<NoteColor>("yellow");
  const [inkColor, setInkColor] = useState<InkColor>("black");
  // Text-first: the lowest-friction way to participate should be the default.
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [text, setText] = useState("");
  const [altText, setAltText] = useState("");
  // Ref, not state: pointer-move events can arrive before a state update
  // re-renders, which would silently drop the start of fast strokes.
  const isDrawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [promptIndex, setPromptIndex] = useState(() =>
    Math.floor(Math.random() * DAILY_PROMPTS.length)
  );

  const dialogRef = useModalDialog({ isOpen: true, onClose });

  const repaintDisplay = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.fillStyle = NOTE_COLORS[noteColor];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (strokeCanvasRef.current) {
      ctx.drawImage(strokeCanvasRef.current, 0, 0);
    }
  }, [noteColor]);

  // Size the canvases when the drawing surface (re)mounts. Strokes are only
  // cleared when the modal transitions closed -> open, so switching between
  // Draw/Type or picking a different note color preserves the drawing.
  useEffect(() => {
    if (inputMode !== "draw") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (scaleRef.current === null) {
      scaleRef.current = Math.min(window.devicePixelRatio || 1, 2);
    }
    const size = CANVAS_SIZE * scaleRef.current;

    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }

    if (!strokeCanvasRef.current) {
      strokeCanvasRef.current = document.createElement("canvas");
    }
    const strokeCanvas = strokeCanvasRef.current;
    if (strokeCanvas.width !== size || strokeCanvas.height !== size) {
      strokeCanvas.width = size;
      strokeCanvas.height = size;
    }

    repaintDisplay();
  }, [inputMode, repaintDisplay]);

  const getPointerPosition = useCallback(
    (
      e: React.MouseEvent | React.TouchEvent
    ): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if ("touches" in e) {
        if (e.touches.length === 0) return null;
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
        };
      }

      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const strokeCtx = strokeCanvasRef.current?.getContext("2d");
      if (!strokeCtx) return;

      const pos = getPointerPosition(e);
      if (!pos) return;

      const lineWidth = brushSize * (scaleRef.current ?? 1);
      strokeCtx.strokeStyle = INK_COLORS[inkColor];
      strokeCtx.fillStyle = INK_COLORS[inkColor];
      strokeCtx.lineWidth = lineWidth;
      strokeCtx.lineCap = "round";
      strokeCtx.lineJoin = "round";

      // A tap with no movement should still leave a dot.
      strokeCtx.beginPath();
      strokeCtx.arc(pos.x, pos.y, lineWidth / 2, 0, Math.PI * 2);
      strokeCtx.fill();

      strokeCtx.beginPath();
      strokeCtx.moveTo(pos.x, pos.y);

      isDrawingRef.current = true;
      setHasDrawn(true);
      repaintDisplay();
    },
    [getPointerPosition, inkColor, brushSize, repaintDisplay]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawingRef.current) return;

      const strokeCtx = strokeCanvasRef.current?.getContext("2d");
      if (!strokeCtx) return;

      const pos = getPointerPosition(e);
      if (!pos) return;

      strokeCtx.lineTo(pos.x, pos.y);
      strokeCtx.stroke();
      repaintDisplay();
    },
    [getPointerPosition, repaintDisplay]
  );

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  const clearCanvas = useCallback(() => {
    const strokeCanvas = strokeCanvasRef.current;
    strokeCanvas
      ?.getContext("2d")
      ?.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    repaintDisplay();
    setHasDrawn(false);
  }, [repaintDisplay]);

  const handlePreparePlace = () => {
    if (!canPost) return;

    if (inputMode === "text") {
      const trimmed = text.trim();
      if (!trimmed) return;
      trackEvent("note_composed", { kind: "text", length: trimmed.length });
      onPreparePlace({
        kind: "text",
        text: trimmed,
        color: noteColor,
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    let imageData = canvas.toDataURL("image/png");

    // Extremely dense drawings at 2x could approach the server's size
    // limit; fall back to a 1x export if needed.
    if (dataUrlByteLength(imageData) > MAX_EXPORT_BYTES) {
      const fallback = document.createElement("canvas");
      fallback.width = CANVAS_SIZE;
      fallback.height = CANVAS_SIZE;
      const fallbackCtx = fallback.getContext("2d");
      if (fallbackCtx) {
        fallbackCtx.drawImage(canvas, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        imageData = fallback.toDataURL("image/png");
      }
    }

    if (!imageData) return;
    trackEvent("note_composed", { kind: "drawing" });
    onPreparePlace({
      kind: "drawing",
      imageData,
      color: noteColor,
      altText: altText.trim() || undefined,
    });
  };

  const nextPrompt = () => {
    setPromptIndex((current) => (current + 1) % DAILY_PROMPTS.length);
  };

  const isValid =
    inputMode === "draw" ? hasDrawn : text.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-creator-title"
    >
      <div
        ref={dialogRef}
        className="modal-card rounded-xl max-w-md w-full max-h-[92dvh] overflow-y-auto"
        style={{ animation: "slideUp 0.3s ease" }}
      >
        {/* Header — MTA sign style */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#1E1E1E] z-10">
          <div>
            <h2
              id="note-creator-title"
              className="text-white text-lg tracking-wide"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase" }}
            >
              Create Your Note
            </h2>
            <p className="text-white/35 text-[11px]" style={{ fontFamily: "var(--font-body)" }}>
              One note per person per day. No account needed.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors touch-target"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {!canPost ? (
            <div className="text-center py-8">
              <div className="mta-bullet-lg mx-auto mb-4" style={{ backgroundColor: "var(--mta-yellow)", color: "#1a1a1a", width: 48, height: 48, fontSize: 24 }}>
                !
              </div>
              <h3
                className="text-white/90 text-base mb-2"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                {cantPostReason}
              </h3>
              {timeUntilNextPost && (
                <p className="text-white/50 text-sm" style={{ fontFamily: "var(--font-body)" }}>
                  Come back in {timeUntilNextPost} to post again.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Mode toggle — styled like MTA tab navigation */}
              <div className="flex rounded-lg bg-white/5 p-1" role="tablist">
                <button
                  role="tab"
                  aria-selected={inputMode === "text"}
                  onClick={() => setInputMode("text")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm transition-colors touch-target ${
                    inputMode === "text"
                      ? "bg-[var(--mta-green)] text-white shadow-lg"
                      : "text-white/50 hover:text-white/80"
                  }`}
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}
                >
                  Type
                </button>
                <button
                  role="tab"
                  aria-selected={inputMode === "draw"}
                  onClick={() => setInputMode("draw")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm transition-colors touch-target ${
                    inputMode === "draw"
                      ? "bg-[var(--mta-green)] text-white shadow-lg"
                      : "text-white/50 hover:text-white/80"
                  }`}
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}
                >
                  Draw
                </button>
              </div>

              {/* Note color selector */}
              <div>
                <label
                  className="block text-[11px] text-white/40 mb-2 tracking-widest uppercase"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  Note Color
                </label>
                <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Note color">
                  {NOTE_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNoteColor(color)}
                      className={`w-9 h-9 rounded-lg transition-all touch-target ${
                        noteColor === color
                          ? "ring-2 ring-offset-2 ring-offset-[#1E1E1E] ring-[var(--mta-yellow)] scale-110"
                          : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: NOTE_COLORS[color] }}
                      role="radio"
                      aria-checked={noteColor === color}
                      aria-label={color}
                    />
                  ))}
                </div>
              </div>

              {/* Ink color selector */}
              <div>
                <label
                  className="block text-[11px] text-white/40 mb-2 tracking-widest uppercase"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  Ink Color
                </label>
                <div className="flex gap-2" role="radiogroup" aria-label="Ink color">
                  {INK_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setInkColor(color)}
                      className={`w-9 h-9 rounded-lg transition-all touch-target ${
                        inkColor === color
                          ? "ring-2 ring-offset-2 ring-offset-[#1E1E1E] ring-[var(--mta-yellow)] scale-110"
                          : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: INK_COLORS[color] }}
                      role="radio"
                      aria-checked={inkColor === color}
                      aria-label={color}
                    />
                  ))}
                </div>
              </div>

              {/* Drawing area or text input */}
              {inputMode === "draw" ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className="text-[11px] text-white/40 tracking-widest uppercase"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                    >
                      Draw your message
                    </label>
                    <div className="flex items-center gap-2">
                      <label htmlFor="brush-size" className="text-[11px] text-white/30 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                        Brush:
                      </label>
                      <input
                        id="brush-size"
                        type="range"
                        min="1"
                        max="10"
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-20 accent-[var(--mta-green)]"
                      />
                    </div>
                  </div>
                  <div
                    className="relative rounded-lg overflow-hidden shadow-lg border border-white/10"
                    style={{ backgroundColor: NOTE_COLORS[noteColor] }}
                  >
                    <canvas
                      ref={canvasRef}
                      className="w-full aspect-square touch-none cursor-crosshair"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      onTouchCancel={stopDrawing}
                      aria-label="Drawing canvas"
                    />
                  </div>
                  <button
                    onClick={clearCanvas}
                    className="mt-2 text-xs text-white/40 hover:text-white/70 transition-colors tracking-wider uppercase"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
                  >
                    Clear drawing
                  </button>
                  <div className="mt-3">
                    <label
                      htmlFor="note-alt-text"
                      className="block text-[11px] text-white/40 mb-1.5 tracking-widest uppercase"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                    >
                      Describe your drawing (optional)
                    </label>
                    <input
                      id="note-alt-text"
                      type="text"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value.slice(0, MAX_CAPTION_LENGTH))}
                      maxLength={MAX_CAPTION_LENGTH}
                      placeholder="Helps screen reader users experience your note"
                      className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[var(--mta-green)]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <label
                      htmlFor="note-text"
                      className="text-[11px] text-white/40 tracking-widest uppercase"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                    >
                      Type your message
                    </label>
                    <button
                      type="button"
                      onClick={nextPrompt}
                      className="text-[11px] text-[var(--mta-green)] hover:text-white transition-colors underline underline-offset-2"
                    >
                      Need a prompt?
                    </button>
                  </div>
                  <div
                    className="rounded-lg overflow-hidden shadow-lg p-4 border border-white/10"
                    style={{ backgroundColor: NOTE_COLORS[noteColor] }}
                  >
                    <textarea
                      id="note-text"
                      value={text}
                      onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
                      placeholder={DAILY_PROMPTS[promptIndex]}
                      className="w-full h-48 bg-transparent resize-none focus:outline-none text-lg"
                      style={{ color: INK_COLORS[inkColor], fontFamily: "var(--font-body)" }}
                      maxLength={MAX_TEXT_LENGTH}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-white/30" style={{ fontFamily: "var(--font-display)" }}>
                    <span>Be kind. Notes are public.</span>
                    <span>{text.length}/{MAX_TEXT_LENGTH}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 sticky bottom-0 bg-[#1E1E1E]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors text-sm tracking-wider uppercase"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Cancel
          </button>
          {canPost && (
            <button
              onClick={handlePreparePlace}
              disabled={!isValid}
              className="px-5 py-2 rounded-lg bg-[var(--mta-green)] text-white hover:bg-[var(--ui-primary-hover)] disabled:opacity-30 disabled:cursor-not-allowed mta-button text-sm tracking-wider touch-target"
            >
              PLACE ON WALL
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
