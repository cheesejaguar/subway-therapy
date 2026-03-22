import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

const moderationStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("flagged")
);

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FLAG_THRESHOLD = 3;

// Public query: only approved notes are visible on the public wall.
export const getPublicNotes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("notes")
      .withIndex("by_moderationStatus", (q) => q.eq("moderationStatus", "approved"))
      .collect();
  },
});

// Public query: viewport fetch, restricted to approved notes.
export const getNotesInViewport = query({
  args: {
    minX: v.number(),
    maxX: v.number(),
    minY: v.number(),
    maxY: v.number(),
  },
  handler: async (ctx, args) => {
    const padding = 200;
    const approvedNotes = await ctx.db
      .query("notes")
      .withIndex("by_moderationStatus", (q) => q.eq("moderationStatus", "approved"))
      .collect();

    return approvedNotes.filter(
      (note) =>
        note.x >= args.minX - padding &&
        note.x <= args.maxX + padding &&
        note.y >= args.minY - padding &&
        note.y <= args.maxY + padding
    );
  },
});

// Internal query: moderation dashboard listing.
export const getNotesForModeration = internalQuery({
  args: {
    status: v.optional(moderationStatus),
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

    return notes.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      if (args.status === "pending" || args.status === "flagged") {
        return dateB - dateA;
      }
      return dateA - dateB;
    });
  },
});

// Internal query: moderation dashboard stats.
export const getStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [pending, approved, rejected, flagged] = await Promise.all([
      ctx.db
        .query("notes")
        .withIndex("by_moderationStatus", (q) => q.eq("moderationStatus", "pending"))
        .collect(),
      ctx.db
        .query("notes")
        .withIndex("by_moderationStatus", (q) => q.eq("moderationStatus", "approved"))
        .collect(),
      ctx.db
        .query("notes")
        .withIndex("by_moderationStatus", (q) => q.eq("moderationStatus", "rejected"))
        .collect(),
      ctx.db
        .query("notes")
        .withIndex("by_moderationStatus", (q) => q.eq("moderationStatus", "flagged"))
        .collect(),
    ]);

    return {
      total: pending.length + approved.length + rejected.length + flagged.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      flagged: flagged.length,
    };
  },
});

// Internal mutation: create a note.
export const createNote = internalMutation({
  args: {
    visibleId: v.string(),
    imageUrl: v.string(),
    color: v.string(),
    x: v.number(),
    y: v.number(),
    rotation: v.number(),
    createdAt: v.string(),
    moderationStatus,
    flagCount: v.number(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const noteId = await ctx.db.insert("notes", args);
    return noteId;
  },
});

// Internal mutation: update moderation status.
export const moderateNote = internalMutation({
  args: {
    visibleId: v.string(),
    status: moderationStatus,
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

// Internal mutation: flag note with per-reporter dedupe.
export const flagNote = internalMutation({
  args: {
    visibleId: v.string(),
    reporterHash: v.string(),
  },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();

    if (notes.length === 0) return null;

    const note = notes[0];
    const existingFlags = await ctx.db
      .query("flags")
      .withIndex("by_visibleId_reporterHash", (q) =>
        q.eq("visibleId", args.visibleId).eq("reporterHash", args.reporterHash)
      )
      .collect();

    if (existingFlags.length > 0) {
      return { flagCount: note.flagCount, duplicate: true };
    }

    await ctx.db.insert("flags", {
      visibleId: args.visibleId,
      reporterHash: args.reporterHash,
      createdAt: new Date().toISOString(),
    });

    const newFlagCount = note.flagCount + 1;
    const updates: { flagCount: number; moderationStatus?: "flagged" } = {
      flagCount: newFlagCount,
    };

    if (newFlagCount >= FLAG_THRESHOLD && note.moderationStatus === "approved") {
      updates.moderationStatus = "flagged";
    }

    await ctx.db.patch(note._id, updates);
    return { flagCount: newFlagCount, duplicate: false };
  },
});

// Internal mutation: delete a note and related flag records.
export const deleteNote = internalMutation({
  args: {
    visibleId: v.string(),
  },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();

    if (notes.length === 0) return { success: false as const };

    const note = notes[0];
    await ctx.db.delete(note._id);

    const flags = await ctx.db
      .query("flags")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();
    await Promise.all(flags.map((flag) => ctx.db.delete(flag._id)));

    return { success: true as const, imageUrl: note.imageUrl };
  },
});

// Internal query: post cooldown in milliseconds for a reporter.
export const getSubmissionCooldown = internalQuery({
  args: {
    reporterHash: v.string(),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_reporterHash_createdAt", (q) => q.eq("reporterHash", args.reporterHash))
      .collect();

    if (submissions.length === 0) {
      return { timeUntilNextPostMs: 0 };
    }

    let latestTimestamp = 0;
    for (const submission of submissions) {
      const ts = new Date(submission.createdAt).getTime();
      if (ts > latestTimestamp) latestTimestamp = ts;
    }

    if (!latestTimestamp) {
      return { timeUntilNextPostMs: 0 };
    }

    const elapsed = args.nowMs - latestTimestamp;
    const remaining = ONE_DAY_MS - elapsed;

    return {
      timeUntilNextPostMs: Math.max(0, remaining),
    };
  },
});

// Internal mutation: record successful note submission and prune stale history.
export const recordSubmission = internalMutation({
  args: {
    reporterHash: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("submissions", {
      reporterHash: args.reporterHash,
      createdAt: args.createdAt,
    });

    const allSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_reporterHash_createdAt", (q) => q.eq("reporterHash", args.reporterHash))
      .collect();

    const cutoff = Date.now() - ONE_DAY_MS * 7;
    await Promise.all(
      allSubmissions
        .filter((submission) => new Date(submission.createdAt).getTime() < cutoff)
        .map((submission) => ctx.db.delete(submission._id))
    );
  },
});
