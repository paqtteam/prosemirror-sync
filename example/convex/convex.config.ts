import { defineApp } from "convex/server";
import prosemirror from "@convex-dev/prosemirror/convex.config";

const app = defineApp();
app.use(prosemirror);

export default app;
