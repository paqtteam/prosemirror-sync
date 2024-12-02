import { internalMutation, query, mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { Prosemirror } from "@convex-dev/prosemirror";

const prosemirror = new Prosemirror(components.prosemirror);
export const { create, submitSteps, get, getSteps, getLatestVersion } =
  prosemirror.syncApi();
