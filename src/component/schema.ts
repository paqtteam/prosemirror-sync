import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  snapshots: defineTable({
    id: v.string(),
    version: v.number(),
    content: v.string(),
  }).index("id_version", ["id", "version"]),
  deltas: defineTable({
    id: v.string(),
    // The version of the last step.
    version: v.number(),
    clientId: v.string(),
    steps: v.array(v.string()),
  }).index("id_version", ["id", "version"]),
});
