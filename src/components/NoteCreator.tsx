"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { NoteColor, InkColor, NOTE_COLORS, INK_COLORS } from "@/lib/types";

interface NoteCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onPreparePlace: (imageData: string, color: NoteColor) => void;
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

export default function NoteCreator({
  isOpen,
  onClose,
  onPreparePlace,
  canPost,
  cantPostReason,
  timeUntilNextPost,
}: NoteCreatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [noteColor, setNoteColor] = useState<NoteColor>("yellow");
  const [inkColor, setInkColor] = useState<InkColor>("black");
  const [inputMode, setInputMode] = useState<InputMode>("draw");
  const [text, setText] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [brushSize, setBrushSize] = useState(3);

  // Track previous note color to detect changes
  const prevNoteColorRef = useRef<NoteColor>(noteColor);

  // Initialize canvas
  useEffect(() => {
    if (!isOpen || inputMode !== "draw") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = 300;
    canvas.height = 300;

    // Clear and fill with note color
    ctx.fillStyle = NOTE_COLORS[noteColor];
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Reset drawing state when note color changes (tracked via ref to avoid setState in effect)
    if (prevNoteColorRef.current !== noteColor) {
      prevNoteColorRef.current = noteColor;
      // Schedule state update outside the effect body
      queueMicrotask(() => setHasDrawn(false));
    }
  }, [isOpen, noteColor, inputMode]);

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
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const pos = getPointerPosition(e);
      if (!pos) return;

      setIsDrawing(true);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = INK_COLORS[inkColor];
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    },
    [getPointerPosition, inkColor, brushSize]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const pos = getPointerPosition(e);
      if (!pos) return;

      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasDrawn(true);
    },
    [isDrawing, getPointerPosition]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.fillStyle = NOTE_COLORS[noteColor];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, [noteColor]);

  const generateImageFromText = useCallback((): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Fill background
    ctx.fillStyle = NOTE_COLORS[noteColor];
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.fillStyle = INK_COLORS[inkColor];
    ctx.font = "20px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Word wrap
    const maxWidth = 260;
    const lineHeight = 26;
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) {
      lines.push(currentLine);
    }

    // Center vertically
    const totalHeight = lines.length * lineHeight;
    const startY = (canvas.height - totalHeight) / 2 + lineHeight / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
    });

    return canvas.toDataURL("image/png");
  }, [noteColor, inkColor, text]);

  const handlePreparePlace = () => {
    if (!canPost) return;

    let imageData: string;

    if (inputMode === "draw") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      imageData = canvas.toDataURL("image/png");
    } else {
      imageData = generateImageFromText();
    }

    onPreparePlace(imageData, noteColor);
  };

  const isValid =
    inputMode === "draw" ? hasDrawn : text.trim().length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-creator-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 id="note-creator-title" className="text-xl font-semibold text-gray-900">
            Create Your Note
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!canPost ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
                <span className="text-3xl">⏰</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {cantPostReason}
              </h3>
              {timeUntilNextPost && (
                <p className="text-gray-600">
                  Come back in {timeUntilNextPost} to post again.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              <div className="flex rounded-lg bg-gray-100 p-1" role="tablist">
                <button
                  role="tab"
                  aria-selected={inputMode === "draw"}
                  onClick={() => setInputMode("draw")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    inputMode === "draw"
                      ? "bg-white shadow text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Draw
                </button>
                <button
                  role="tab"
                  aria-selected={inputMode === "text"}
                  onClick={() => setInputMode("text")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    inputMode === "text"
                      ? "bg-white shadow text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Type
                </button>
              </div>

              {/* Note color selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note Color
                </label>
                <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Note color">
                  {NOTE_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNoteColor(color)}
                      className={`w-10 h-10 rounded-lg shadow-sm transition-transform ${
                        noteColor === color
                          ? "ring-2 ring-offset-2 ring-[var(--ui-primary)] scale-110"
                          : "hover:scale-105"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ink Color
                </label>
                <div className="flex gap-2" role="radiogroup" aria-label="Ink color">
                  {INK_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setInkColor(color)}
                      className={`w-10 h-10 rounded-lg shadow-sm transition-transform ${
                        inkColor === color
                          ? "ring-2 ring-offset-2 ring-[var(--ui-primary)] scale-110"
                          : "hover:scale-105"
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
                    <label className="block text-sm font-medium text-gray-700">
                      Draw your message
                    </label>
                    <div className="flex items-center gap-2">
                      <label htmlFor="brush-size" className="text-xs text-gray-500">
                        Brush:
                      </label>
                      <input
                        id="brush-size"
                        type="range"
                        min="1"
                        max="10"
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-20"
                      />
                    </div>
                  </div>
                  <div
                    className="relative rounded-lg overflow-hidden shadow-lg"
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
                      aria-label="Drawing canvas"
                    />
                  </div>
                  <button
                    onClick={clearCanvas}
                    className="mt-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Clear drawing
                  </button>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="note-text"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Type your message
                  </label>
                  <div
                    className="rounded-lg overflow-hidden shadow-lg p-4"
                    style={{ backgroundColor: NOTE_COLORS[noteColor] }}
                  >
                    <textarea
                      id="note-text"
                      value={text}
                      onChange={(e) => setText(e.target.value.slice(0, 200))}
                      placeholder="What's on your mind?"
                      className="w-full h-48 bg-transparent resize-none focus:outline-none text-lg"
                      style={{ color: INK_COLORS[inkColor] }}
                      maxLength={200}
                    />
                  </div>
                  <div className="mt-1 text-right text-xs text-gray-500">
                    {text.length}/200
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
          >
            Cancel
          </button>
          {canPost && (
            <button
              onClick={handlePreparePlace}
              disabled={!isValid}
              className="px-6 py-2 rounded-lg bg-[var(--ui-primary)] text-white font-medium hover:bg-[var(--ui-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Place on Wall
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
