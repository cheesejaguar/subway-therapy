"use client";

import React from "react";

interface OnboardingPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    number: "1",
    bulletColor: "#EE352E",
    title: "Draw or type your note",
    description: "Express yourself freely, anonymously.",
  },
  {
    number: "2",
    bulletColor: "#FCCC0A",
    title: "Post it to the wall",
    description: "One note per person per day.",
  },
  {
    number: "3",
    bulletColor: "#00933C",
    title: "Explore others\u2019 notes",
    description: "Pan and zoom to discover messages from around the world.",
  },
];

export default function OnboardingPopup({
  isOpen,
  onClose,
}: OnboardingPopupProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="modal-card rounded-xl max-w-md w-full mx-4 overflow-hidden"
        style={{ animation: "slideUp 0.35s ease" }}
      >
        {/* Hero — MTA sign style header */}
        <div
          className="relative px-8 pt-8 pb-6 text-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1C1C1C 0%, #2A2A2A 100%)" }}
        >
          {/* Decorative subway line stripe */}
          <div className="absolute top-0 left-0 right-0 h-1 flex">
            <div className="flex-1" style={{ background: "#EE352E" }} />
            <div className="flex-1" style={{ background: "#FF6319" }} />
            <div className="flex-1" style={{ background: "#FCCC0A" }} />
            <div className="flex-1" style={{ background: "#00933C" }} />
            <div className="flex-1" style={{ background: "#0039A6" }} />
            <div className="flex-1" style={{ background: "#B933AD" }} />
          </div>

          {/* MTA-style station name */}
          <div className="inline-block mb-3">
            <div className="flex gap-1.5 justify-center mb-4">
              {["S", "T"].map((letter) => (
                <div
                  key={letter}
                  className="mta-bullet-lg"
                  style={{ backgroundColor: "#00933C" }}
                >
                  {letter}
                </div>
              ))}
            </div>
          </div>

          <h1
            id="onboarding-title"
            className="text-white text-2xl mb-1"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Subway Therapy
          </h1>
          <p
            className="text-white/60 text-sm"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Share your thoughts with the world
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-4">
          {STEPS.map((step) => (
            <div key={step.number} className="flex items-start gap-3">
              <div
                className="mta-bullet flex-shrink-0 mt-0.5"
                style={{ backgroundColor: step.bulletColor }}
              >
                {step.number}
              </div>
              <div>
                <h3
                  className="text-white/90 text-sm"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  {step.title}
                </h3>
                <p className="text-white/50 text-xs mt-0.5" style={{ fontFamily: "var(--font-body)" }}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}

          <div className="pt-3 border-t border-white/10">
            <p className="text-white/30 text-[11px] text-center leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
              No account needed. Your privacy is protected.
              <br />
              Notes are moderated to keep this space safe.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 px-6 rounded-lg bg-[var(--mta-green)] text-white hover:bg-[var(--ui-primary-hover)] mta-button text-sm tracking-widest"
          >
            START EXPLORING
          </button>
        </div>
      </div>
    </div>
  );
}
