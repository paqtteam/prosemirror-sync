import { defineApp } from "convex/server";
import prosemirror from "@convex-dev/prosemirror-sync/convex.config";

const app = defineApp();
app.use(prosemirror);

export default app;
