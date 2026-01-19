import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Check if an identifier (hashed IP) can post a note
export const canPost = query({
  args: {
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const oneDayAgo = now - ONE_DAY_MS;

    // Query for rate limit records from this identifier in the last 24 hours
    const recentRecords = await ctx.db
      .query("rateLimits")
      .withIndex("by_identifier_and_time", (q) =>
        q.eq("identifier", args.identifier).gte("createdAt", oneDayAgo)
      )
      .collect();

    if (recentRecords.length > 0) {
      // Find the most recent submission
      const mostRecent = recentRecords.reduce((latest, record) =>
        record.createdAt > latest.createdAt ? record : latest
      );

      const timeUntilNextPost = mostRecent.createdAt + ONE_DAY_MS - now;

      return {
        canPost: false,
        reason: "Only one note per person per day!",
        timeUntilNextPost: Math.max(0, timeUntilNextPost),
      };
    }

    return { canPost: true };
  },
});

// Record a rate limit event
export const recordSubmission = mutation({
  args: {
    identifier: v.string(),
    noteId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("rateLimits", {
      identifier: args.identifier,
      createdAt: Date.now(),
      noteId: args.noteId,
    });
    return { success: true };
  },
});

// Clean up old rate limit records (can be called periodically)
export const cleanupOldRecords = mutation({
  args: {},
  handler: async (ctx) => {
    const twoDaysAgo = Date.now() - 2 * ONE_DAY_MS;

    // Get all old records
    const oldRecords = await ctx.db
      .query("rateLimits")
      .collect();

    const toDelete = oldRecords.filter((record) => record.createdAt < twoDaysAgo);

    for (const record of toDelete) {
      await ctx.db.delete(record._id);
    }

    return { deleted: toDelete.length };
  },
});
