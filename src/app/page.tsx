"use client";

import React, { useState, useEffect, useCallback } from "react";
import Wall from "@/components/Wall";
import NoteCreator from "@/components/NoteCreator";
import OnboardingPopup from "@/components/OnboardingPopup";
import { StickyNote, NoteColor, ViewportBounds } from "@/lib/types";

const ONBOARDING_STORAGE_KEY = "subway_therapy_onboarded";

export default function Home() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [canPost, setCanPost] = useState(true);
  const [cantPostReason, setCantPostReason] = useState<string>();
  const [timeUntilNextPost, setTimeUntilNextPost] = useState<string>();
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null
  );

  // Check onboarding status
  useEffect(() => {
    const hasOnboarded = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!hasOnboarded) {
      setShowOnboarding(true);
    }
  }, []);

  // Fetch initial notes
  useEffect(() => {
    fetchNotes();
  }, []);

  // Check session status
  useEffect(() => {
    checkSession();
  }, []);

  const fetchNotes = async (bounds?: ViewportBounds) => {
    try {
      let url = "/api/notes";
      if (bounds) {
        const params = new URLSearchParams({
          minX: bounds.minX.toString(),
          maxX: bounds.maxX.toString(),
          minY: bounds.minY.toString(),
          maxY: bounds.maxY.toString(),
        });
        url += `?${params}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch notes");

      const data = await response.json();
      setNotes(data.notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleViewportChange = useCallback((bounds: ViewportBounds) => {
    // Debounced fetch of notes in viewport
    fetchNotes(bounds);
  }, []);

  const handleNoteClick = (note: StickyNote) => {
    // Could open a modal with larger view
    console.log("Note clicked:", note.id);
  };

  const handleFlagNote = async (noteId: string) => {
    try {
      const response = await fetch("/api/notes/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });

      if (!response.ok) throw new Error("Failed to flag note");

      const data = await response.json();
      alert(data.message);
    } catch (error) {
      console.error("Error flagging note:", error);
      alert("Failed to report note. Please try again.");
    }
  };

  const handleSubmitNote = async (imageData: string, color: NoteColor) => {
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, color }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit note");
      }

      setSubmissionMessage(data.message);
      setShowCreator(false);
      setCanPost(false);
      setCantPostReason("Only one note per person per day!");

      // Refresh notes
      await fetchNotes();

      // Clear message after delay
      setTimeout(() => setSubmissionMessage(null), 5000);
    } catch (error) {
      console.error("Error submitting note:", error);
      alert(
        error instanceof Error ? error.message : "Failed to submit note"
      );
    }
  };

  const handleCloseOnboarding = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setShowOnboarding(false);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Main wall */}
      <Wall
        notes={notes}
        onNoteClick={handleNoteClick}
        onFlagNote={handleFlagNote}
        onViewportChange={handleViewportChange}
        isLoading={isLoading}
      />

      {/* Add note button */}
      <button
        onClick={() => setShowCreator(true)}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 bg-[var(--ui-primary)] text-white font-semibold rounded-full shadow-lg hover:bg-[var(--ui-primary-hover)] transition-all hover:scale-105 focus:ring-4 focus:ring-[var(--ui-primary)]/50 touch-target z-30"
        aria-label="Add your note"
      >
        Add Your Note
      </button>

      {/* Submission success message */}
      {submissionMessage && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-40 animate-[fadeIn_0.3s_ease]"
          role="status"
          aria-live="polite"
        >
          {submissionMessage}
        </div>
      )}

      {/* Note creator modal */}
      <NoteCreator
        isOpen={showCreator}
        onClose={() => setShowCreator(false)}
        onSubmit={handleSubmitNote}
        canPost={canPost}
        cantPostReason={cantPostReason}
        timeUntilNextPost={timeUntilNextPost}
      />

      {/* Onboarding popup */}
      <OnboardingPopup
        isOpen={showOnboarding}
        onClose={handleCloseOnboarding}
      />

      {/* Accessibility skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white px-4 py-2 rounded shadow z-50"
      >
        Skip to main content
      </a>

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {isLoading ? "Loading notes..." : `${notes.length} notes loaded`}
      </div>
    </div>
  );
}
