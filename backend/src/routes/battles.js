import express from "express";
import { getAllBattles, fetchAndSaveBattle, getWarSummary, deleteBattle } from "../services/battleService.js";

const router = express.Router();

// Track fetch progress for range fetching
const fetchProgress = {
  isRunning: false,
  current: 0,
  total: 0,
  completed: [],
  failed: [],
  lastError: null,
};

/**
 * GET /api/battles
 * Get all battles from database
 */
router.get("/", async (req, res) => {
  try {
    const battles = await getAllBattles();
    res.json({ success: true, data: battles });
  } catch (error) {
    console.log("Error getting battles:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/battles/fetch
 * Fetch a battle from Eclesiar API and save to database
 * Body: { battleId: number }
 */
router.post("/fetch", async (req, res) => {
  try {
    const { battleId, apiKey } = req.body;

    if (!battleId) {
      return res.status(400).json({ success: false, error: "battleId is required" });
    }

    console.log(`Fetching battle ${battleId} from API...`);
    const battle = await fetchAndSaveBattle(battleId, apiKey);

    res.json({ success: true, data: battle, message: "Battle fetched and saved successfully" });
  } catch (error) {
    console.log("Error fetching battle:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/battles/fetch-range
 * Fetch a range of battles from Eclesiar API and save to database
 * Body: { fromId: number, toId: number }
 */
router.post("/fetch-range", async (req, res) => {
  try {
    const { fromId, toId, apiKey } = req.body;

    if (!fromId || !toId) {
      return res.status(400).json({ success: false, error: "fromId and toId are required" });
    }

    if (fromId > toId) {
      return res.status(400).json({ success: false, error: "fromId must be less than or equal to toId" });
    }

    if (fetchProgress.isRunning) {
      return res.status(409).json({ success: false, error: "A fetch operation is already in progress" });
    }

    // Reset progress
    fetchProgress.isRunning = true;
    fetchProgress.current = 0;
    fetchProgress.total = toId - fromId + 1;
    fetchProgress.completed = [];
    fetchProgress.failed = [];
    fetchProgress.lastError = null;

    // Start fetching in background
    (async () => {
      for (let battleId = fromId; battleId <= toId; battleId++) {
        fetchProgress.current = battleId - fromId + 1;
        try {
          console.log(`Fetching battle ${battleId} (${fetchProgress.current}/${fetchProgress.total})...`);
          await fetchAndSaveBattle(battleId, apiKey);
          fetchProgress.completed.push(battleId);
        } catch (error) {
          console.log(`Failed to fetch battle ${battleId}:`, error.message);
          fetchProgress.failed.push({ id: battleId, error: error.message });
          fetchProgress.lastError = error.message;
        }
      }
      fetchProgress.isRunning = false;
      console.log(
        `Range fetch completed. Success: ${fetchProgress.completed.length}, Failed: ${fetchProgress.failed.length}`
      );
    })();

    res.json({
      success: true,
      message: `Started fetching battles from ${fromId} to ${toId} (${fetchProgress.total} battles)`,
    });
  } catch (error) {
    console.log("Error starting range fetch:", error.message);
    fetchProgress.isRunning = false;
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/battles/fetch-progress
 * Get the progress of the current range fetch operation
 */
router.get("/fetch-progress", (req, res) => {
  res.json({
    success: true,
    data: {
      isRunning: fetchProgress.isRunning,
      current: fetchProgress.current,
      total: fetchProgress.total,
      completedCount: fetchProgress.completed.length,
      failedCount: fetchProgress.failed.length,
      failed: fetchProgress.failed,
      lastError: fetchProgress.lastError,
    },
  });
});

/**
 * POST /api/battles/summary
 * Get war summary for selected battles
 * Body: { battleIds: number[] }
 */
router.post("/summary", async (req, res) => {
  try {
    const { battleIds } = req.body;

    if (!battleIds || !Array.isArray(battleIds) || battleIds.length === 0) {
      return res.status(400).json({ success: false, error: "battleIds array is required" });
    }

    const summary = await getWarSummary(battleIds);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.log("Error getting summary:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/battles/:id
 * Delete a battle from database
 */
router.delete("/:id", async (req, res) => {
  try {
    const battleId = parseInt(req.params.id);
    await deleteBattle(battleId);
    res.json({ success: true, message: "Battle deleted successfully" });
  } catch (error) {
    console.log("Error deleting battle:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
