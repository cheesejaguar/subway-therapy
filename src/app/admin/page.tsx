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

const SESSION_KEY = "subway_admin_key";

export default function AdminDashboard() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const storedKey = sessionStorage.getItem(SESSION_KEY);
    if (storedKey) {
      setApiKey(storedKey);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);

    try {
      // Test the key by making a request
      const response = await fetch("/api/admin/notes?status=pending", {
        headers: {
          Authorization: `Bearer ${passwordInput}`,
        },
      });

      if (response.status === 401) {
        setAuthError("Invalid password");
        return;
      }

      if (!response.ok) {
        setAuthError("Authentication failed");
        return;
      }

      // Success - store key and set authenticated
      sessionStorage.setItem(SESSION_KEY, passwordInput);
      setApiKey(passwordInput);
      setIsAuthenticated(true);
      setPasswordInput("");
    } catch {
      setAuthError("Connection error");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setApiKey("");
    setIsAuthenticated(false);
    setNotes([]);
    setStats(null);
  };

  const authHeaders = useCallback(() => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }, [apiKey]);

  const fetchNotes = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filter !== "all") {
        params.set("status", filter);
      }

      const response = await fetch(`/api/admin/notes?${params}`, {
        headers: authHeaders(),
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch notes");
      }

      const data = await response.json();
      setNotes(data.notes);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [filter, isAuthenticated, authHeaders]);

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
        headers: authHeaders(),
        body: JSON.stringify({ noteId, action }),
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to moderate note");
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
        headers: authHeaders(),
        body: JSON.stringify({
          noteIds: Array.from(selectedNotes),
          action,
        }),
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to batch moderate notes");
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Moderation Dashboard
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Admin Password
              </label>
              <input
                id="password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--ui-primary)] focus:border-transparent"
                placeholder="Enter admin password"
                required
                autoFocus
              />
            </div>
            {authError && (
              <div className="text-red-600 text-sm">{authError}</div>
            )}
            <button
              type="submit"
              disabled={isAuthenticating || !passwordInput}
              className="w-full py-2 px-4 bg-[var(--ui-primary)] text-white font-medium rounded-lg hover:bg-[var(--ui-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAuthenticating ? "Authenticating..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Subway Therapy - Moderation Dashboard
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg shadow p-4">
              <div className="text-sm text-yellow-700">Pending</div>
              <div className="text-2xl font-bold text-yellow-800">
                {stats.pending}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg shadow p-4">
              <div className="text-sm text-green-700">Approved</div>
              <div className="text-2xl font-bold text-green-800">
                {stats.approved}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg shadow p-4">
              <div className="text-sm text-red-700">Rejected</div>
              <div className="text-2xl font-bold text-red-800">
                {stats.rejected}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg shadow p-4">
              <div className="text-sm text-orange-700">Flagged</div>
              <div className="text-2xl font-bold text-orange-800">
                {stats.flagged}
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px" aria-label="Tabs">
              {(
                ["pending", "flagged", "approved", "rejected", "all"] as const
              ).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 ${
                    filter === status
                      ? "border-[var(--ui-primary)] text-[var(--ui-primary)]"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Batch actions */}
          {selectedNotes.size > 0 && (
            <div className="p-4 bg-gray-50 flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {selectedNotes.size} selected
              </span>
              <button
                onClick={() => handleBatchModerate("approve")}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                Approve All
              </button>
              <button
                onClick={() => handleBatchModerate("reject")}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Reject All
              </button>
              <button
                onClick={() => handleBatchModerate("delete")}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700"
              >
                Delete All
              </button>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Notes grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[var(--ui-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No notes to display
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedNotes.size === notes.length}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Color
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Flags
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {notes.map((note) => (
                  <tr
                    key={note.id}
                    className={selectedNotes.has(note.id) ? "bg-blue-50" : ""}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedNotes.has(note.id)}
                        onChange={() => toggleSelectNote(note.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="w-16 h-16 rounded shadow overflow-hidden"
                        style={{ backgroundColor: NOTE_COLORS[note.color] }}
                      >
                        {note.imageUrl && (
                          <img
                            src={note.imageUrl}
                            alt="Note preview"
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="w-6 h-6 rounded shadow"
                        style={{ backgroundColor: NOTE_COLORS[note.color] }}
                        title={note.color}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(note.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          note.moderationStatus === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : note.moderationStatus === "approved"
                            ? "bg-green-100 text-green-800"
                            : note.moderationStatus === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {note.moderationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {note.flagCount > 0 ? (
                        <span className="text-orange-600 font-medium">
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
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            Approve
                          </button>
                        )}
                        {note.moderationStatus !== "rejected" && (
                          <button
                            onClick={() => handleModerate(note.id, "reject")}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => handleModerate(note.id, "delete")}
                          className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
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
