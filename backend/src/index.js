import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { testConnection } from "./config/database.js";
import battlesRouter from "./routes/battles.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/battles", battlesRouter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
