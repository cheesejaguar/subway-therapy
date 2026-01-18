import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  notes: defineTable({
    visibleId: v.string(), // UUID for external reference
    imageUrl: v.string(),
    color: v.string(),
    x: v.number(),
    y: v.number(),
    rotation: v.number(),
    createdAt: v.string(),
    moderationStatus: v.string(), // "pending" | "approved" | "rejected" | "flagged"
    flagCount: v.number(),
    sessionId: v.string(),
  })
    .index("by_visibleId", ["visibleId"])
    .index("by_moderationStatus", ["moderationStatus"])
    .index("by_sessionId", ["sessionId"]),
});
