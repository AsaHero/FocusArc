import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PORT, CLIENT_DIST } from "./config.js";
import { migrate } from "./db.js";
import { router } from "./routes.js";

migrate();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Serve the built frontend as a single unit (production). The SPA fallback
// returns index.html for any non-API route so client-side state works on reload.
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(resolve(CLIENT_DIST, "index.html"));
  });
  console.log(`[server] serving frontend from ${CLIENT_DIST}`);
}

app.listen(PORT, () => {
  console.log(`[server] FocusArc listening on http://localhost:${PORT}`);
});
