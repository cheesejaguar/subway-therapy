import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const moderationStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("flagged")
);

export default defineSchema({
  notes: defineTable({
    visibleId: v.string(), // UUID for external reference
    imageUrl: v.string(),
    color: v.string(),
    x: v.number(),
    y: v.number(),
    rotation: v.number(),
    createdAt: v.string(),
    moderationStatus, // "pending" | "approved" | "rejected" | "flagged"
    flagCount: v.number(),
    sessionId: v.string(),
  })
    .index("by_visibleId", ["visibleId"])
    .index("by_moderationStatus", ["moderationStatus"])
    .index("by_status_createdAt", ["moderationStatus", "createdAt"])
    .index("by_sessionId", ["sessionId"]),
  flags: defineTable({
    visibleId: v.string(),
    reporterHash: v.string(),
    createdAt: v.string(),
  })
    .index("by_visibleId", ["visibleId"])
    .index("by_visibleId_reporterHash", ["visibleId", "reporterHash"]),
  submissions: defineTable({
    reporterHash: v.string(),
    createdAt: v.string(),
  }).index("by_reporterHash_createdAt", ["reporterHash", "createdAt"]),
});
