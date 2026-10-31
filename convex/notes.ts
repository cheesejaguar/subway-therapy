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
const PUBLIC_PAGE_SIZE = 48;
const MAX_PUBLIC_PAGE_SIZE = 100;

const noteKind = v.union(v.literal("text"), v.literal("drawing"));

const reactionKind = v.union(
  v.literal("heart"),
  v.literal("hug"),
  v.literal("strength"),
  v.literal("metoo")
);

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

// Public query: a single approved note for permalink pages and share cards.
export const getApprovedNoteByVisibleId = query({
  args: { visibleId: v.string() },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();
    return notes.find((note) => note.moderationStatus === "approved") ?? null;
  },
});

// Public query: gallery page, newest first with a simple cursor. The gallery
// is curated by humans and only ever shows approved notes.
export const getApprovedNotesPage = query({
  args: {
    limit: v.optional(v.number()),
    before: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(
      MAX_PUBLIC_PAGE_SIZE,
      Math.max(1, Math.floor(args.limit ?? PUBLIC_PAGE_SIZE))
    );
    const query = ctx.db
      .query("notes")
      .withIndex("by_status_createdAt", (q) => {
        const base = q.eq("moderationStatus", "approved");
        return args.before ? base.lt("createdAt", args.before) : base;
      })
      .order("desc");
    return await query.take(limit);
  },
});

// Public query: full-text search over text, captions, and transcripts.
export const searchApprovedNotes = query({
  args: {
    term: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const term = args.term.trim().slice(0, 120);
    if (!term) return [];
    const limit = Math.min(
      MAX_PUBLIC_PAGE_SIZE,
      Math.max(1, Math.floor(args.limit ?? PUBLIC_PAGE_SIZE))
    );
    return await ctx.db
      .query("notes")
      .withSearchIndex("search_text", (q) =>
        q.search("searchText", term).eq("moderationStatus", "approved")
      )
      .take(limit);
  },
});

// Public query: random approved note for the "take me somewhere" affordance.
export const getRandomApprovedNote = query({
  args: {},
  handler: async (ctx) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_moderationStatus", (q) => q.eq("moderationStatus", "approved"))
      .collect();
    if (notes.length === 0) return null;
    return notes[Math.floor(Math.random() * notes.length)];
  },
});

// Public query: wall-level counts for the live HUD and gallery.
export const getPublicStats = query({
  args: {},
  handler: async (ctx) => {
    const approved = await ctx.db
      .query("notes")
      .withIndex("by_moderationStatus", (q) => q.eq("moderationStatus", "approved"))
      .collect();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const today = approved.filter(
      (note) => new Date(note.createdAt).getTime() >= todayStart.getTime()
    ).length;
    const reactions = approved.reduce(
      (total, note) => total + (note.reactionCount ?? 0),
      0
    );
    return {
      total: approved.length,
      today,
      reactions,
      countries: new Set(
        approved.map((note) => note.countryCode).filter(Boolean)
      ).size,
    };
  },
});

// Public query: viewport fetch using the by_status_x range index so reads
// scale with the requested slice of wall, not the total number of notes.
// The wall is 600,000px wide but only 4,200px tall, so an x-range scan plus
// a JS filter on y is effectively a spatial query.
export const getApprovedNotesInRange = query({
  args: {
    minX: v.number(),
    maxX: v.number(),
    minY: v.number(),
    maxY: v.number(),
  },
  handler: async (ctx, args) => {
    const padding = 200;
    // Stream the full x-range rather than using a fixed .take() cap, which
    // would silently truncate dense tiles. Convex's per-query document scan
    // limit is the loud backstop, and it sits far above the physical note
    // density a 2,000px slice of wall can hold.
    const notes = [];
    for await (const note of ctx.db
      .query("notes")
      .withIndex("by_status_x", (q) =>
        q
          .eq("moderationStatus", "approved")
          .gte("x", args.minX - padding)
          .lte("x", args.maxX + padding)
      )) {
      if (note.y >= args.minY - padding && note.y <= args.maxY + padding) {
        notes.push(note);
      }
    }
    return notes;
  },
});

// Legacy public query kept for deployment-skew compatibility: an older Next
// deployment may still call it, and a newer Next deployment falls back to it
// when this Convex deployment predates getApprovedNotesInRange.
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
    kind: v.optional(noteKind),
    text: v.optional(v.string()),
    caption: v.optional(v.string()),
    altText: v.optional(v.string()),
    thumbUrl: v.optional(v.string()),
    reactionCount: v.optional(v.number()),
    reactionCounts: v.optional(
      v.object({
        heart: v.number(),
        hug: v.number(),
        strength: v.number(),
        metoo: v.number(),
      })
    ),
    countryCode: v.optional(v.string()),
    searchText: v.optional(v.string()),
    manageTokenHash: v.optional(v.string()),
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
    reason: v.optional(v.string()),
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
      reason: args.reason?.trim().slice(0, 120),
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

// Internal mutation: add a reaction with per-reporter/per-kind dedupe and
// update the denormalized counts stored on the note.
export const addReaction = internalMutation({
  args: {
    visibleId: v.string(),
    reporterHash: v.string(),
    kind: reactionKind,
  },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();
    const note = notes.find((candidate) => candidate.moderationStatus === "approved");
    if (!note) return null;

    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_visibleId_reporterHash_kind", (q) =>
        q
          .eq("visibleId", args.visibleId)
          .eq("reporterHash", args.reporterHash)
          .eq("kind", args.kind)
      )
      .collect();
    if (existing.length > 0) {
      return {
        duplicate: true,
        reactionCount: note.reactionCount ?? 0,
        reactionCounts: note.reactionCounts ?? {
          heart: 0,
          hug: 0,
          strength: 0,
          metoo: 0,
        },
      };
    }

    await ctx.db.insert("reactions", {
      visibleId: args.visibleId,
      reporterHash: args.reporterHash,
      kind: args.kind,
      createdAt: new Date().toISOString(),
    });

    const counts = {
      heart: 0,
      hug: 0,
      strength: 0,
      metoo: 0,
      ...(note.reactionCounts ?? {}),
    };
    counts[args.kind] += 1;
    const reactionCount = counts.heart + counts.hug + counts.strength + counts.metoo;
    await ctx.db.patch(note._id, { reactionCounts: counts, reactionCount });

    return { duplicate: false, reactionCount, reactionCounts: counts };
  },
});

// Internal query: report reasons for the admin review drawer.
export const getFlagReasons = internalQuery({
  args: { visibleId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("flags")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();
  },
});

// Internal mutation: delete a note and related flag/reaction records.
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
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", args.visibleId))
      .collect();
    await Promise.all([
      ...flags.map((flag) => ctx.db.delete(flag._id)),
      ...reactions.map((reaction) => ctx.db.delete(reaction._id)),
    ]);

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

// Internal mutation: atomically check the daily cooldown and record the
// submission in one serializable transaction, closing the check-then-write
// race between concurrent posts from the same reporter.
export const reserveSubmission = internalMutation({
  args: {
    reporterHash: v.string(),
    createdAt: v.string(),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_reporterHash_createdAt", (q) =>
        q.eq("reporterHash", args.reporterHash)
      )
      .collect();

    let latestTimestamp = 0;
    for (const submission of submissions) {
      const ts = new Date(submission.createdAt).getTime();
      if (ts > latestTimestamp) latestTimestamp = ts;
    }

    if (latestTimestamp) {
      const remaining = ONE_DAY_MS - (args.nowMs - latestTimestamp);
      if (remaining > 0) {
        return { reserved: false as const, timeUntilNextPostMs: remaining };
      }
    }

    const submissionId = await ctx.db.insert("submissions", {
      reporterHash: args.reporterHash,
      createdAt: args.createdAt,
    });

    // Prune stale history while we hold the reporter's rows anyway.
    const cutoff = args.nowMs - ONE_DAY_MS * 7;
    await Promise.all(
      submissions
        .filter((submission) => new Date(submission.createdAt).getTime() < cutoff)
        .map((submission) => ctx.db.delete(submission._id))
    );

    return { reserved: true as const, submissionId };
  },
});

// Internal mutation: roll back a reservation whose note failed downstream
// (image upload or persistence error), restoring the reporter's daily slot.
export const releaseSubmission = internalMutation({
  args: {
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.submissionId);
    if (existing) {
      await ctx.db.delete(args.submissionId);
    }
    return null;
  },
});

// Internal mutation: record successful note submission and prune stale history.
// Legacy path kept for deployment skew: an older Next deployment still calls it.
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
