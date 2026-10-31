"use client";

import React, { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

interface WallMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onWander: () => void;
  onShare: () => void;
  onOpenList: () => void;
  ambientEnabled: boolean;
  onToggleAmbient: () => void;
  stats: { total: number; today: number; reactions: number } | null;
}

const NAV_LINKS = [
  { href: "/gallery", label: "Gallery", note: "Browse every note" },
  { href: "/host", label: "Host a Wall", note: "Print cards for your space" },
  { href: "/about", label: "About", note: "The story and the founder" },
  { href: "/guidelines", label: "Guidelines", note: "How we keep it safe" },
];

export default function WallMenu({
  isOpen,
  onClose,
  onWander,
  onShare,
  onOpenList,
  ambientEnabled,
  onToggleAmbient,
  stats,
}: WallMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30 bg-black/20 cursor-default"
        aria-label="Close menu"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className="fixed top-4 right-4 z-40 station-chrome rounded-xl w-[min(320px,calc(100vw-2rem))] overflow-hidden"
        style={{ animation: "slideUp 0.2s ease" }}
        role="dialog"
        aria-modal="false"
        aria-label="Wall menu"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <p
              className="text-white text-sm uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
            >
              Subway Therapy
            </p>
            <p className="text-white/35 text-[10px]" style={{ fontFamily: "var(--font-body)" }}>
              {stats
                ? `${stats.total} notes · ${stats.today} today · ${stats.reactions} reactions`
                : "A virtual wall for what we carry"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white rounded-full hover:bg-white/10 touch-target"
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>

        <div className="p-2">
          <button
            type="button"
            onClick={() => {
              trackEvent("wander_clicked", { source: "menu" });
              onWander();
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors group"
          >
            <span className="block text-white/85 text-sm" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              Take me somewhere
            </span>
            <span className="block text-white/35 text-[11px] group-hover:text-white/50">
              Jump to a random note on the wall
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenList();
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors group"
          >
            <span className="block text-white/85 text-sm" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              List view
            </span>
            <span className="block text-white/35 text-[11px] group-hover:text-white/50">
              Read the wall as a list, with search
            </span>
          </button>

          <div className="my-2 border-t border-white/10" />

          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="block px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-colors group"
            >
              <span className="block text-white/80 text-sm" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
                {link.label}
              </span>
              <span className="block text-white/30 text-[11px] group-hover:text-white/50">
                {link.note}
              </span>
            </a>
          ))}

          <div className="my-2 border-t border-white/10" />

          <button
            type="button"
            onClick={() => {
              trackEvent("share_clicked", { channel: "wall" });
              onShare();
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors text-white/80 text-sm"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Share this wall
          </button>
          <button
            type="button"
            onClick={() => {
              trackEvent("ambient_toggled", { enabled: !ambientEnabled });
              onToggleAmbient();
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors flex items-center justify-between"
            aria-pressed={ambientEnabled}
          >
            <span className="text-white/80 text-sm" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              Platform ambience
            </span>
            <span className={`text-[10px] uppercase tracking-wider ${ambientEnabled ? "text-[var(--mta-green)]" : "text-white/30"}`}>
              {ambientEnabled ? "On" : "Off"}
            </span>
          </button>
        </div>

        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-white/25 text-[10px] leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
            An independent tribute to the original Subway Therapy project by
            Matthew Chavez. Not affiliated with the MTA.
          </p>
        </div>
      </div>
    </>
  );
}
