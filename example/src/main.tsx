import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App.tsx";
import "./index.css";

const address = import.meta.env.VITE_CONVEX_URL;

const convex = new ConvexReactClient(address);

// Fetch the id from the URL hash, or make a new one
const id = window.location.hash.slice(1) || crypto.randomUUID();
if (window.location.hash !== `#${id}`) {
  window.location.hash = `#${id}`;
}

createRoot(document.getElementById("root")!).render(
  <ConvexProvider client={convex}>
    <App id={id} />
  </ConvexProvider>
);
