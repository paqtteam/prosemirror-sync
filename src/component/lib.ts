import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const add = mutation({
  args: {
    name: v.string(),
    count: v.number(),
    shards: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const shard = Math.floor(Math.random() * (args.shards ?? 1));
    const prosemirror = await ctx.db
      .query("prosemirrors")
      .withIndex("name", (q) => q.eq("name", args.name).eq("shard", shard))
      .unique();
    if (prosemirror) {
      await ctx.db.patch(prosemirror._id, {
        value: prosemirror.value + args.count,
      });
    } else {
      await ctx.db.insert("prosemirrors", {
        name: args.name,
        value: args.count,
        shard,
      });
    }
  },
});

export const count = query({
  args: { name: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const prosemirrors = await ctx.db
      .query("prosemirrors")
      .withIndex("name", (q) => q.eq("name", args.name))
      .collect();
    return prosemirrors.reduce(
      (sum, prosemirror) => sum + prosemirror.value,
      0
    );
  },
});
