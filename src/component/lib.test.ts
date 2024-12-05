/// <reference types="vite/client" />

import { webcrypto as crypto } from "node:crypto";
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema.js";
import { api } from "./_generated/api.js";

const modules = import.meta.glob("./**/*.*s");

describe("prosemirror lib", () => {
  test("submitSteps needs rebase", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    const clientId = "client1";
    await t.run(async (ctx) => {
      await ctx.db.insert("snapshots", {
        id,
        version: 0,
        content: "",
      });
      await ctx.db.insert("deltas", {
        id,
        version: 2,
        clientId,
        steps: ["1", "2"],
      });
    });
    expect(
      await t.mutation(api.lib.submitSteps, {
        id,
        clientId,
        version: 0,
        steps: ["a"],
      })
    ).toEqual({
      status: "needs-rebase",
      clientIds: [clientId, clientId],
      steps: ["1", "2"],
    });
  });
  test("submitSteps synced", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    const clientId = "client1";
    await t.run(async (ctx) => {
      await ctx.db.insert("snapshots", {
        id,
        version: 0,
        content: "",
      });
    });
    expect(
      await t.mutation(api.lib.submitSteps, {
        id,
        clientId,
        version: 0,
        steps: ["a", "b"],
      })
    ).toEqual({ status: "synced" });
    const { steps, clientIds, version } = await t.query(api.lib.getSteps, {
      id,
      version: 0,
    });
    expect(steps).toEqual(["a", "b"]);
    expect(clientIds).toEqual([clientId, clientId]);
    expect(version).toEqual(2);
  });
  test("getSteps skips steps before version", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    const clientId = "client1";
    const clientId2 = "client2";
    await t.run(async (ctx) => {
      await ctx.db.insert("deltas", {
        id,
        version: 2,
        clientId,
        steps: ["1", "2"],
      });
      await ctx.db.insert("deltas", {
        id,
        version: 3,
        clientId: clientId2,
        steps: ["3"],
      });
    });
    const { steps, clientIds, version } = await t.query(api.lib.getSteps, {
      id,
      version: 1,
    });
    expect(steps).toEqual(["2", "3"]);
    expect(clientIds).toEqual([clientId, clientId2]);
    expect(version).toEqual(3);
  });
  test("get handles missing snapshot", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    const { content, steps, version } = await t.query(api.lib.get, {
      id,
      version: 2,
    });
    expect(content).toEqual(null);
    expect(steps).toEqual(undefined);
    expect(version).toEqual(undefined);
    const ignoringSteps = await t.query(api.lib.get, {
      id,
      version: 2,
      ignoreSteps: true,
    });
    expect(ignoringSteps.content).toEqual(null);
    expect(ignoringSteps.steps).toEqual(undefined);
    expect(ignoringSteps.version).toEqual(undefined);
  });
  test("get works with only snapshot", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    await t.run(async (ctx) => {
      await ctx.db.insert("snapshots", {
        id,
        version: 0,
        content: "content",
      });
    });
    const { content, steps, version } = await t.query(api.lib.get, {
      id,
      version: 0,
    });
    expect(content).toEqual("content");
    expect(steps).toEqual([]);
    expect(version).toEqual(0);
  });
  test("get ignores steps when asked", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    const clientId = "client1";
    await t.run(async (ctx) => {
      await ctx.db.insert("snapshots", {
        id,
        version: 0,
        content: "content",
      });
      await ctx.db.insert("deltas", {
        id,
        version: 2,
        clientId,
        steps: ["1", "2"],
      });
    });
    const { content, steps, version } = await t.query(api.lib.get, {
      id,
      version: 2,
      ignoreSteps: true,
    });
    expect(content).toEqual("content");
    expect(steps).toEqual([]);
    expect(version).toEqual(0);
  });
  test("get skips steps before snapshot", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    const clientId = "client1";
    await t.run(async (ctx) => {
      await ctx.db.insert("snapshots", {
        id,
        version: 1,
        content: "content",
      });
      await ctx.db.insert("deltas", {
        id,
        version: 2,
        clientId,
        steps: ["1", "2"],
      });
    });
    const { content, steps, version } = await t.query(api.lib.get, {
      id,
      version: 2,
    });
    expect(content).toEqual("content");
    expect(steps).toEqual(["2"]);
    expect(version).toEqual(2);
  });
  test("get skips steps before snapshot & beyond version", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    const clientId = "client1";
    const clientId2 = "client2";
    await t.run(async (ctx) => {
      await ctx.db.insert("snapshots", {
        id,
        version: 0,
        content: "old content",
      });
      await ctx.db.insert("deltas", {
        id,
        version: 2,
        clientId,
        steps: ["1", "2"],
      });
      await ctx.db.insert("snapshots", {
        id,
        version: 1,
        content: "new content",
      });
      await ctx.db.insert("deltas", {
        id,
        version: 4,
        clientId: clientId2,
        steps: ["3", "4"],
      });
    });
    const { content, steps, version } = await t.query(api.lib.get, {
      id,
      version: 3,
    });
    expect(content).toEqual("new content");
    expect(steps).toEqual(["2", "3"]);
    expect(version).toEqual(3);
  });
  test("create, submit, then get works", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    await t.mutation(api.lib.submitSnapshot, {
      id,
      version: 0,
      content: "content",
    });
    await t.mutation(api.lib.submitSteps, {
      id,
      clientId: "client1",
      version: 0,
      steps: ["a", "b"],
    });
    const { content, steps, version } = await t.query(api.lib.get, {
      id,
      version: 2,
    });
    expect(content).toEqual("content");
    expect(steps).toEqual(["a", "b"]);
    expect(version).toEqual(2);
  });
  test("submitSnapshot same content is idempotent", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    await t.mutation(api.lib.submitSnapshot, {
      id,
      version: 0,
      content: "content",
    });
    await t.mutation(api.lib.submitSnapshot, {
      id,
      version: 0,
      content: "content",
    });
  });
  test("submitSnapshot different content is error", async () => {
    const t = convexTest(schema, modules);
    const id = crypto.randomUUID();
    await t.mutation(api.lib.submitSnapshot, {
      id,
      version: 0,
      content: "content",
    });
    await expect(
      t.mutation(api.lib.submitSnapshot, {
        id,
        version: 0,
        content: "other content",
      })
    ).rejects.toThrow();
  });
});
