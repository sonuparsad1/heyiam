import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import * as db from "./server/db";
import * as ai from "./server/ai";
import { portfolioData } from "./src/data/portfolio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Starting full-stack server...");

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/portfolio", (req, res) => {
    const metadata = db.getPortfolioMetadata();
    if (metadata && Object.keys(metadata).length > 0) {
      res.json({ ...portfolioData, ...metadata });
    } else {
      res.json(portfolioData);
    }
  });

  app.post("/api/portfolio", (req, res) => {
    const data = req.body;
    db.updatePortfolioMetadata(data);
    res.json({ success: true });
  });

  app.get("/api/history/:sessionId", (req, res) => {
    const history = db.getHistory(req.params.sessionId);
    res.json(history);
  });

  app.delete("/api/history/:sessionId", (req, res) => {
    db.clearHistory(req.params.sessionId);
    res.json({ success: true });
  });

  app.post("/api/chat", async (req, res) => {
    const { sessionId, prompt, images, mode, aspectRatio, useThinking, apiKey } = req.body;
    
    try {
      const history = db.getHistory(sessionId);
      
      let response;
      if (mode === 'image') {
        response = await ai.generateImage(prompt, aspectRatio, apiKey);
        db.saveMessage(sessionId, "user", `[IMAGE_REQUEST] ${prompt}`, images);
        db.saveMessage(sessionId, "model", `[IMAGE] ${response}`);
      } else if (mode === 'video') {
        const videoUri = await ai.generateVideo(prompt, images?.[0], aspectRatio, apiKey);
        response = `[VIDEO]${videoUri}[/VIDEO]`;
        db.saveMessage(sessionId, "user", `[VIDEO_REQUEST] ${prompt}`, images);
        db.saveMessage(sessionId, "model", response);
      } else {
        response = await ai.generateTextResponse(history, prompt, images, useThinking, apiKey);
        db.saveMessage(sessionId, "user", prompt, images);
        db.saveMessage(sessionId, "model", response);
      }

      res.json({ text: response });
    } catch (error: any) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for video downloads to avoid CORS and handle API keys
  app.get("/api/proxy/video", async (req, res) => {
    const { uri, apiKey } = req.query;
    if (!uri) return res.status(400).send("URI is required");
    
    try {
      const key = (apiKey as string) || process.env.GEMINI_API_KEY || "";
      const response = await fetch(uri as string, {
        headers: { 'x-goog-api-key': key }
      });
      
      if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
      
      const contentType = response.headers.get("content-type") || "video/mp4";
      res.setHeader("Content-Type", contentType);
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
