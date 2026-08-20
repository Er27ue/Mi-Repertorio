import cors from "cors";
import express from "express";
import { createSongsRouter } from "./routes/songs.js";

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "6mb" }));
  app.use(createSongsRouter(db));
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}
