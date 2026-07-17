"use client";

import React, { useState, useEffect, useCallback } from "react";
import { StickyNote, ModerationStatus, NOTE_COLORS } from "@/lib/types";

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  flagged: number;
}

type FilterStatus = ModerationStatus | "all";

// Shared style objects — presentation only
const displayFont: React.CSSProperties = { fontFamily: "var(--font-display)" };

const condensedLabel: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
};

const tabLabel: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

// Decorative subway-line stripe (mirrors OnboardingPopup's header stripe)
const mtaStripe: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(90deg, var(--mta-red) 0% 16.67%, var(--mta-orange) 16.67% 33.33%, var(--mta-yellow) 33.33% 50%, var(--mta-green) 50% 66.67%, var(--mta-blue) 66.67% 83.33%, var(--mta-purple) 83.33% 100%)",
  backgroundSize: "100% 4px",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "top left",
};

// One tile per moderation bucket; yellow needs dark text for contrast.
const STAT_TILES: Array<{
  key: keyof Stats;
  label: string;
  bullet: string;
  bulletColor: string;
  bulletText?: string;
}> = [
  { key: "total", label: "Total", bullet: "T", bulletColor: "var(--mta-blue)" },
  { key: "pending", label: "Pending", bullet: "P", bulletColor: "var(--mta-yellow)", bulletText: "#1A1A1A" },
  { key: "approved", label: "Approved", bullet: "A", bulletColor: "var(--mta-green)" },
  { key: "rejected", label: "Rejected", bullet: "R", bulletColor: "var(--mta-red)" },
  { key: "flagged", label: "Flagged", bullet: "F", bulletColor: "var(--mta-orange)" },
];

export default function AdminDashboard() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Check existing auth session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/admin/auth");
        if (response.status === 503) {
          const data = await response.json();
          setConfigError(data.error || "Admin authentication is not configured");
          setIsAuthenticated(false);
          return;
        }

        if (!response.ok) {
          setIsAuthenticated(false);
          return;
        }

        const data = await response.json();
        setIsAuthenticated(!!data.authenticated);
      } catch {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);

    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });

      if (response.status === 503) {
        const data = await response.json();
        setConfigError(data.error || "Admin authentication is not configured");
        return;
      }

      if (response.status === 401) {
        setAuthError("Invalid password");
        return;
      }

      if (!response.ok) {
        setAuthError("Authentication failed");
        return;
      }

      setIsAuthenticated(true);
      setPasswordInput("");
      setConfigError(null);
    } catch {
      setAuthError("Connection error");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setNotes([]);
    setStats(null);
    setSelectedNotes(new Set());
    setError(null);
  }, []);

  const logoutRequest = useCallback(async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } catch {
      // No-op: local logout state still applies.
    } finally {
      handleLogout();
    }
  }, [handleLogout]);

  const fetchNotes = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filter !== "all") {
        params.set("status", filter);
      }

      const response = await fetch(`/api/admin/notes?${params}`);

      if (response.status === 401) {
        await logoutRequest();
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to fetch notes");
      }

      const data = await response.json();
      setNotes(data.notes);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [filter, isAuthenticated, logoutRequest]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotes();
    }
  }, [fetchNotes, isAuthenticated]);

  const handleModerate = async (
    noteId: string,
    action: "approve" | "reject" | "delete"
  ) => {
    try {
      const response = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, action }),
      });

      if (response.status === 401) {
        await logoutRequest();
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to moderate note");
      }

      await fetchNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to moderate");
    }
  };

  const handleBatchModerate = async (action: "approve" | "reject" | "delete") => {
    if (selectedNotes.size === 0) return;

    try {
      const response = await fetch("/api/admin/moderate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteIds: Array.from(selectedNotes),
          action,
        }),
      });

      if (response.status === 401) {
        await logoutRequest();
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to batch moderate notes");
      }

      setSelectedNotes(new Set());
      await fetchNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to batch moderate");
    }
  };

  const toggleSelectNote = (noteId: string) => {
    setSelectedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedNotes.size === notes.length) {
      setSelectedNotes(new Set());
    } else {
      setSelectedNotes(new Set(notes.map((n) => n.id)));
    }
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--station-dark)] flex items-center justify-center">
        <div className="modal-card rounded-xl max-w-md w-full mx-4 overflow-hidden">
          <h1
            className="text-white text-xl px-6 py-5 border-b border-white/10 text-center uppercase tracking-wider"
            style={{ ...mtaStripe, fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Moderation Dashboard
          </h1>
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-[11px] text-white/40 mb-2 tracking-widest uppercase"
                style={condensedLabel}
              >
                Admin Password
              </label>
              <input
                id="password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--mta-green)] focus:border-transparent"
                placeholder="Enter admin password"
                required
                autoFocus
              />
            </div>
            {authError && (
              <div className="text-white/90 text-sm px-3 py-2 rounded bg-[rgba(238,53,46,0.12)] border-l-4 border-l-[var(--mta-red)]">{authError}</div>
            )}
            {configError && (
              <div className="text-white/90 text-sm px-3 py-2 rounded bg-[rgba(238,53,46,0.12)] border-l-4 border-l-[var(--mta-red)]">{configError}</div>
            )}
            <button
              type="submit"
              disabled={isAuthenticating || !passwordInput || !!configError}
              className="w-full py-3 px-4 rounded-lg bg-[var(--mta-green)] text-white hover:bg-[var(--ui-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed mta-button text-sm tracking-widest touch-target"
            >
              {isAuthenticating ? "Authenticating..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--station-dark)]">
      {/* Header */}
      <header
        className="bg-[var(--station-sign-bg)] border-b border-white/10"
        style={mtaStripe}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1
            className="text-white text-xl uppercase tracking-wider"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Subway Therapy - Moderation Dashboard
          </h1>
          <button
            onClick={logoutRequest}
            className="px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg mta-button touch-target transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {STAT_TILES.map((tile) => (
              <div key={tile.key} className="station-chrome rounded-lg p-4">
                <div
                  className="flex items-center gap-2 text-[11px] text-white/60 uppercase tracking-widest"
                  style={condensedLabel}
                >
                  <span
                    className="mta-bullet-sm"
                    style={{ backgroundColor: tile.bulletColor, color: tile.bulletText }}
                    aria-hidden="true"
                  >
                    {tile.bullet}
                  </span>
                  {tile.label}
                </div>
                <div className="text-2xl font-bold text-white mt-1" style={displayFont}>
                  {stats[tile.key]}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="station-chrome rounded-lg mb-6">
          <div className="p-2">
            <nav className="flex rounded-lg bg-white/5 p-1 overflow-x-auto" aria-label="Tabs">
              {(
                ["pending", "flagged", "approved", "rejected", "all"] as const
              ).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`flex-1 py-3 px-4 rounded-md text-sm whitespace-nowrap transition-colors ${
                    filter === status
                      ? "bg-[var(--mta-green)] text-white shadow-lg"
                      : "text-white/50 hover:text-white/80"
                  }`}
                  style={tabLabel}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Batch actions */}
          {selectedNotes.size > 0 && (
            <div className="px-4 py-3 border-t border-white/10 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-white/60">
                {selectedNotes.size} selected
              </span>
              <button
                onClick={() => handleBatchModerate("approve")}
                className="px-4 py-2 bg-[var(--mta-green)] text-white rounded-lg text-sm hover:bg-[var(--ui-primary-hover)] mta-button touch-target"
              >
                Approve All
              </button>
              <button
                onClick={() => handleBatchModerate("reject")}
                className="px-4 py-2 bg-[var(--mta-red)] text-white rounded-lg text-sm hover:bg-[#C42B25] mta-button touch-target"
              >
                Reject All
              </button>
              <button
                onClick={() => handleBatchModerate("delete")}
                className="px-4 py-2 bg-white/10 text-white/90 border border-white/10 rounded-lg text-sm hover:bg-white/20 mta-button touch-target"
              >
                Delete All
              </button>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-[rgba(238,53,46,0.1)] border border-white/10 border-l-4 border-l-[var(--mta-red)] text-white/90 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Notes grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[var(--mta-green)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div
            className="text-center py-12 text-white/60 text-sm uppercase tracking-widest"
            style={condensedLabel}
          >
            No notes to display
          </div>
        ) : (
          <div className="station-chrome rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedNotes.size === notes.length}
                      onChange={toggleSelectAll}
                      className="rounded accent-[var(--mta-green)]"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] text-white/40 uppercase tracking-widest" style={condensedLabel}>
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] text-white/40 uppercase tracking-widest" style={condensedLabel}>
                    Color
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] text-white/40 uppercase tracking-widest" style={condensedLabel}>
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] text-white/40 uppercase tracking-widest" style={condensedLabel}>
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] text-white/40 uppercase tracking-widest" style={condensedLabel}>
                    Flags
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] text-white/40 uppercase tracking-widest" style={condensedLabel}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {notes.map((note) => (
                  <tr
                    key={note.id}
                    className={
                      selectedNotes.has(note.id)
                        ? "bg-[rgba(0,57,166,0.25)]"
                        : "hover:bg-white/[0.04] transition-colors"
                    }
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedNotes.has(note.id)}
                        onChange={() => toggleSelectNote(note.id)}
                        className="rounded accent-[var(--mta-green)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="w-16 h-16 rounded shadow-lg overflow-hidden border border-white/10"
                        style={{ backgroundColor: NOTE_COLORS[note.color] }}
                      >
                        {note.imageUrl && (
                          <img
                            src={note.imageUrl}
                            alt="Note preview"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="w-6 h-6 rounded shadow border border-white/10"
                        style={{ backgroundColor: NOTE_COLORS[note.color] }}
                        title={note.color}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">
                      {new Date(note.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                          note.moderationStatus === "pending"
                            ? "bg-[var(--mta-yellow)] text-black"
                            : note.moderationStatus === "approved"
                            ? "bg-[var(--mta-green)] text-white"
                            : note.moderationStatus === "rejected"
                            ? "bg-[var(--mta-red)] text-white"
                            : "bg-[var(--mta-orange)] text-black"
                        }`}
                        style={displayFont}
                      >
                        {note.moderationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/40">
                      {note.flagCount > 0 ? (
                        <span className="text-[var(--mta-orange)] font-semibold">
                          {note.flagCount}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {note.moderationStatus !== "approved" && (
                          <button
                            onClick={() => handleModerate(note.id, "approve")}
                            className="px-3 bg-[var(--mta-green)] text-white text-xs rounded hover:bg-[var(--ui-primary-hover)] mta-button touch-target"
                          >
                            Approve
                          </button>
                        )}
                        {note.moderationStatus !== "rejected" && (
                          <button
                            onClick={() => handleModerate(note.id, "reject")}
                            className="px-3 bg-[var(--mta-red)] text-white text-xs rounded hover:bg-[#C42B25] mta-button touch-target"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => handleModerate(note.id, "delete")}
                          className="px-3 bg-white/10 text-white/90 border border-white/10 text-xs rounded hover:bg-white/20 mta-button touch-target"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
