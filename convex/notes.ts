import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all public notes (approved + pending, for public wall)
export const getPublicNotes = query({
  args: {},
  handler: async (ctx) => {
    const allNotes = await ctx.db.query("notes").collect();
    // Return approved and pending notes (pending shown with placeholder)
    return allNotes.filter(
      (note) => note.moderationStatus === "approved" || note.moderationStatus === "pending"
    );
  },
});

// Get notes in viewport (for lazy loading)
export const getNotesInViewport = query({
  args: {
    minX: v.number(),
    maxX: v.number(),
    minY: v.number(),
    maxY: v.number(),
  },
  handler: async (ctx, args) => {
    const padding = 200;
    const allNotes = await ctx.db.query("notes").collect();

    // Filter to approved + pending, within viewport
    return allNotes.filter(
      (note) =>
        (note.moderationStatus === "approved" || note.moderationStatus === "pending") &&
        note.x >= args.minX - padding &&
        note.x <= args.maxX + padding &&
        note.y >= args.minY - padding &&
        note.y <= args.maxY + padding
    );
  },
});

// Get all notes for moderation
export const getNotesForModeration = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let notes;
    if (args.status) {
      notes = await ctx.db
        .query("notes")
        .withIndex("by_moderationStatus", (q) => q.eq("moderationStatus", args.status!))
        .collect();
    } else {
      notes = await ctx.db.query("notes").collect();
    }

    // Sort by creation date
    return notes.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      if (args.status === "pending" || args.status === "flagged") {
        return dateB - dateA; // Newest first
      }
      return dateA - dateB;
    });
  },
});

// Get note by visible ID
export const getNoteByVisibleId = query({
  args: { visibleId: v.string() },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();
    return notes[0] || null;
  },
});

// Get stats for admin dashboard
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allNotes = await ctx.db.query("notes").collect();

    const stats = {
      total: allNotes.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      flagged: 0,
    };

    for (const note of allNotes) {
      switch (note.moderationStatus) {
        case "pending":
          stats.pending++;
          break;
        case "approved":
          stats.approved++;
          break;
        case "rejected":
          stats.rejected++;
          break;
        case "flagged":
          stats.flagged++;
          break;
      }
    }

    return stats;
  },
});

// Create a new note
export const createNote = mutation({
  args: {
    visibleId: v.string(),
    imageUrl: v.string(),
    color: v.string(),
    x: v.number(),
    y: v.number(),
    rotation: v.number(),
    createdAt: v.string(),
    moderationStatus: v.string(),
    flagCount: v.number(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const noteId = await ctx.db.insert("notes", args);
    return noteId;
  },
});

// Update note moderation status
export const moderateNote = mutation({
  args: {
    visibleId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();

    if (notes.length === 0) return null;

    await ctx.db.patch(notes[0]._id, { moderationStatus: args.status });
    return { success: true };
  },
});

// Flag a note
export const flagNote = mutation({
  args: {
    visibleId: v.string(),
  },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();

    if (notes.length === 0) return null;

    const note = notes[0];
    const newFlagCount = note.flagCount + 1;
    const updates: { flagCount: number; moderationStatus?: string } = {
      flagCount: newFlagCount,
    };

    // Auto-hide if flagged multiple times
    if (newFlagCount >= 3 && note.moderationStatus === "approved") {
      updates.moderationStatus = "flagged";
    }

    await ctx.db.patch(note._id, updates);
    return { flagCount: newFlagCount };
  },
});

// Delete a note
export const deleteNote = mutation({
  args: {
    visibleId: v.string(),
  },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();

    if (notes.length === 0) return { success: false };

    await ctx.db.delete(notes[0]._id);
    return { success: true, imageUrl: notes[0].imageUrl };
  },
});
