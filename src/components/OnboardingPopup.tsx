"use client";

import React from "react";

interface OnboardingPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingPopup({
  isOpen,
  onClose,
}: OnboardingPopupProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Hero section */}
        <div className="bg-gradient-to-br from-[var(--note-yellow)] to-[var(--note-orange)] p-8 text-center">
          <h1
            id="onboarding-title"
            className="text-3xl font-bold text-gray-900 mb-2"
          >
            Welcome to Subway Therapy
          </h1>
          <p className="text-lg text-gray-800">
            Share your thoughts with the world
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--note-pink)] flex items-center justify-center flex-shrink-0">
              <span className="text-lg">1</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                Draw or type your note
              </h3>
              <p className="text-sm text-gray-600">
                Express yourself freely, anonymously.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--note-blue)] flex items-center justify-center flex-shrink-0">
              <span className="text-lg">2</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                Post it to the wall
              </h3>
              <p className="text-sm text-gray-600">
                One note per person per day.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--note-green)] flex items-center justify-center flex-shrink-0">
              <span className="text-lg">3</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                Explore others&apos; notes
              </h3>
              <p className="text-sm text-gray-600">
                Pan and zoom to discover messages from around the world.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              No account needed. Your privacy is protected.
              <br />
              Notes are moderated to keep this space safe.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 px-6 rounded-lg bg-[var(--ui-primary)] text-white font-medium hover:bg-[var(--ui-primary-hover)] text-lg"
          >
            Start Exploring
          </button>
        </div>
      </div>
    </div>
  );
}
