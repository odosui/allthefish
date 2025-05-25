import { Express } from "express";
import { CHAT_STORE } from ".";
import { ChatSession } from "../../shared/types";
import { MODELS } from "./models";

export function addRestRoutes(
  app: Express,
  project: {
    port: number;
  },
) {
  // allow CORS
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:5173");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // Serve static files or APIs
  app.get("/", (_req, res) => {
    res.json({ status: "OK" });
  });

  app.get("/api/project", async (_req, res) => {
    res.json(project);
  });

  app.get("/api/profiles", async (_req, res) => {
    try {
      const profiles = Object.entries(MODELS).map(([name, p]) => {
        return {
          name,
          vendor: p.vendor,
          model: p.model,
        };
      });
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/chat/:id", async (req, res) => {
    const id = req.params.id;
    const chat = CHAT_STORE[id];

    if (!chat) {
      res.status(404).json({ error: "Chat not found" });
      return;
    }

    const data: ChatSession = {
      id,
      name: chat.profile,
      serverUrl: chat.worker.serverUrl(),
    };

    res.json(data);
  });
}
