import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const moderationStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("flagged")
);

const noteKind = v.union(v.literal("text"), v.literal("drawing"));

const reactionKind = v.union(
  v.literal("heart"),
  v.literal("hug"),
  v.literal("strength"),
  v.literal("metoo")
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
    // Text layer. Optional so notes created before the migration keep working.
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
  })
    .index("by_visibleId", ["visibleId"])
    .index("by_moderationStatus", ["moderationStatus"])
    .index("by_status_createdAt", ["moderationStatus", "createdAt"])
    .index("by_status_x", ["moderationStatus", "x"])
    .index("by_sessionId", ["sessionId"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["moderationStatus"],
    }),
  flags: defineTable({
    visibleId: v.string(),
    reporterHash: v.string(),
    reason: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_visibleId", ["visibleId"])
    .index("by_visibleId_reporterHash", ["visibleId", "reporterHash"]),
  reactions: defineTable({
    visibleId: v.string(),
    reporterHash: v.string(),
    kind: reactionKind,
    createdAt: v.string(),
  })
    .index("by_visibleId", ["visibleId"])
    .index("by_visibleId_reporterHash", ["visibleId", "reporterHash"])
    .index("by_visibleId_reporterHash_kind", [
      "visibleId",
      "reporterHash",
      "kind",
    ]),
  submissions: defineTable({
    reporterHash: v.string(),
    createdAt: v.string(),
  }).index("by_reporterHash_createdAt", ["reporterHash", "createdAt"]),
  rateLimits: defineTable({
    key: v.string(),
    timestamps: v.array(v.number()),
  }).index("by_key", ["key"]),
});
