import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { testConnection } from "./config/database.js";
import battlesRouter from "./routes/battles.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/battles", battlesRouter);

// Health check endpoint
app.get("/api/health", async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: dbStatus ? "ok" : "degraded",
    database: dbStatus ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
    env: {
      nodeEnv: process.env.NODE_ENV || "(not set)",
      port: process.env.PORT || "(not set)",
      dbHost: process.env.DB_HOST ? "set" : "missing",
      dbPort: process.env.DB_PORT ? "set" : "missing",
      dbUser: process.env.DB_USER ? "set" : "missing",
      dbName: process.env.DB_NAME ? "set" : "missing",
      dbPassword: process.env.DB_PASSWORD ? "set" : "missing",
      eclesiarApiUrl: process.env.ECLESIAR_API_URL ? "set" : "missing",
      eclesiarApiKey: process.env.ECLESIAR_API_KEY ? "set" : "missing",
    },
  });
});

// Serve static frontend in production (built files in backend/public)
const publicPath = path.join(__dirname, "..", "public");
app.use(express.static(publicPath));

// SPA fallback – serve index.html for any non-API route
app.get("*", (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(publicPath, "index.html"));
});

// Start server
async function start() {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.log("Warning: Database connection failed. Some features may not work.");
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
