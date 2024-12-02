import { internalMutation, query, mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { Prosemirror } from "@convex-dev/prosemirror";

const prosemirror = new Prosemirror(components.prosemirror, {
  shards: { beans: 10, users: 100 },
});
const numUsers = prosemirror.for("users");

export const addOne = mutation({
  args: {},
  handler: async (ctx, _args) => {
    await numUsers.inc(ctx);
  },
});

export const getCount = query({
  args: {},
  handler: async (ctx, _args) => {
    return await numUsers.count(ctx);
  },
});

export const usingClient = internalMutation({
  args: {},
  handler: async (ctx, _args) => {
    await prosemirror.add(ctx, "accomplishments");
    await prosemirror.add(ctx, "beans", 2);
    const count = await prosemirror.count(ctx, "beans");
    return count;
  },
});

export const usingFunctions = internalMutation({
  args: {},
  handler: async (ctx, _args) => {
    await numUsers.inc(ctx);
    await numUsers.inc(ctx);
    await numUsers.dec(ctx);
    return numUsers.count(ctx);
  },
});

export const directCall = internalMutation({
  args: {},
  handler: async (ctx, _args) => {
    await ctx.runMutation(components.prosemirror.lib.add, {
      name: "pennies",
      count: 250,
    });
    await ctx.runMutation(components.prosemirror.lib.add, {
      name: "beans",
      count: 3,
      shards: 100,
    });
    const count = await ctx.runQuery(components.prosemirror.lib.count, {
      name: "beans",
    });
    return count;
  },
});

// Direct re-export of component's API.
export const { add, count } = prosemirror.api();
