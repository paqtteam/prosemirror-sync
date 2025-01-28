import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Any tables used by the example app go here.
  documents: defineTable({
    docId: v.string(),
    content: v.string(),
  })
    .index("docId", ["docId"])
    .searchIndex("search_documents", { searchField: "content" }),
});
