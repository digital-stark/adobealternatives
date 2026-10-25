// Optional browser development server. The installed desktop app does not run this server.
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { generateLocally, localAIStatus } from "./desktop/local-ai.mjs";
const app = express();
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});
app.use(express.json({ limit: "90mb" }));
app.get("/api/status", async (req, res) => {
  try {
    res.json(await localAIStatus(req.query.endpoint));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.post("/api/generate", async (req, res) => {
  try {
    res.json(await generateLocally(req.body));
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});
if (process.argv.includes("--production")) {
  app.use(
    express.static(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "dist"),
    ),
  );
  app.get("/{*path}", (_, res) =>
    res.sendFile(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "dist/index.html",
      ),
    ),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      middlewareMode: true,
      hmr: process.env.PRISM_TEST === "1" ? false : undefined,
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use((err, req, res, next) =>
  res.status(400).json({ error: "Invalid request or image too large." }),
);
app.listen(Number(process.env.PORT) || 3000, "127.0.0.1", () =>
  console.log(
    "Prism browser development server on port " + (process.env.PORT || 3000),
  ),
);
