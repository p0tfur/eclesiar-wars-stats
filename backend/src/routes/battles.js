import express from "express";
import {
  getAllBattles,
  fetchAndSaveBattle,
  fetchAndSaveCurrentRound,
  getWarSummary,
  getDailyHitSummary,
  getPlayerBattleDetails,
  deleteBattle,
  backfillRoundHeroes,
} from "../services/battleService.js";
import { getBattleAutoSyncStatus, runBattleAutoSyncOnce } from "../services/battleAutoSync.js";

const router = express.Router();

const FETCH_RANGE_MAX_BATTLES = Number(process.env.FETCH_RANGE_MAX_BATTLES || 100);
const FETCH_RANGE_DELAY_MS = Number(process.env.FETCH_RANGE_DELAY_MS || 250);
const FETCH_PROGRESS_FAILED_LIMIT = Number(process.env.FETCH_PROGRESS_FAILED_LIMIT || 100);

// Track fetch progress for range fetching
const fetchProgress = {
  isRunning: false,
  current: 0,
  total: 0,
  completedCount: 0,
  failed: [],
  failedCount: 0,
  lastError: null,
  startedAt: null,
  finishedAt: null,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pushFailed(errorEntry) {
  if (fetchProgress.failed.length >= FETCH_PROGRESS_FAILED_LIMIT) {
    fetchProgress.failed.shift();
  }
  fetchProgress.failed.push(errorEntry);
}

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
 * POST /api/battles/backfill-heroes
 * Trigger backfill of attackers_hero/defenders_hero
 * Body: { apiKey?: string }
 */
router.post("/backfill-heroes", async (req, res) => {
  try {
    const { apiKey } = req.body || {};
    const result = await backfillRoundHeroes(apiKey);
    res.json({ success: true, data: result });
  } catch (error) {
    console.log("Error running hero backfill:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/battles/player-details
 * Get per-battle details for a single player
 * Body: { battleIds: number[], playerId: number }
 */
router.post("/player-details", async (req, res) => {
  try {
    const { battleIds, playerId } = req.body;

    if (!battleIds || !Array.isArray(battleIds) || battleIds.length === 0) {
      return res.status(400).json({ success: false, error: "battleIds array is required" });
    }

    if (!playerId) {
      return res.status(400).json({ success: false, error: "playerId is required" });
    }

    const details = await getPlayerBattleDetails(battleIds, Number(playerId));
    res.json({ success: true, data: details });
  } catch (error) {
    console.log("Error getting player details:", error.message);
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
    const parsedBattleId = Number(battleId);

    if (!Number.isInteger(parsedBattleId) || parsedBattleId <= 0) {
      return res.status(400).json({ success: false, error: "battleId must be a positive integer" });
    }

    if (fetchProgress.isRunning) {
      return res.status(409).json({
        success: false,
        error: "Range fetch is in progress. Wait until it finishes to run single fetch.",
      });
    }

    console.log(`Fetching battle ${parsedBattleId} from API...`);
    const battle = await fetchAndSaveBattle(parsedBattleId, apiKey);

    res.json({ success: true, data: battle, message: "Battle fetched and saved successfully" });
  } catch (error) {
    // Log full error stack for debugging
    console.log("Error fetching battle:", error.message);
    console.log("Stack:", error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/battles/fetch-current-round
 * Fetch only the current round for live battle updates
 * Body: { battleId: number, apiKey?: string }
 */
router.post("/fetch-current-round", async (req, res) => {
  try {
    const { battleId, apiKey } = req.body;
    const parsedBattleId = Number(battleId);

    if (!Number.isInteger(parsedBattleId) || parsedBattleId <= 0) {
      return res.status(400).json({ success: false, error: "battleId must be a positive integer" });
    }

    if (fetchProgress.isRunning) {
      return res.status(409).json({
        success: false,
        error: "Range fetch is in progress. Wait until it finishes to run live round fetch.",
      });
    }

    console.log(`Live refreshing current round for battle ${parsedBattleId}...`);
    const result = await fetchAndSaveCurrentRound(parsedBattleId, apiKey);

    res.json({ success: true, data: result, message: "Current round fetched and saved successfully" });
  } catch (error) {
    console.log("Error fetching current round:", error.message);
    console.log("Stack:", error.stack);
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
    const parsedFromId = Number(fromId);
    const parsedToId = Number(toId);

    if (!Number.isInteger(parsedFromId) || !Number.isInteger(parsedToId) || parsedFromId <= 0 || parsedToId <= 0) {
      return res.status(400).json({ success: false, error: "fromId and toId must be positive integers" });
    }

    if (parsedFromId > parsedToId) {
      return res.status(400).json({ success: false, error: "fromId must be less than or equal to toId" });
    }

    const total = parsedToId - parsedFromId + 1;
    if (total > FETCH_RANGE_MAX_BATTLES) {
      return res.status(400).json({
        success: false,
        error: `Range too large. Max ${FETCH_RANGE_MAX_BATTLES} battles per request`,
      });
    }

    if (fetchProgress.isRunning) {
      return res.status(409).json({ success: false, error: "A fetch operation is already in progress" });
    }

    // Reset progress
    fetchProgress.isRunning = true;
    fetchProgress.current = 0;
    fetchProgress.total = total;
    fetchProgress.completedCount = 0;
    fetchProgress.failed = [];
    fetchProgress.failedCount = 0;
    fetchProgress.lastError = null;
    fetchProgress.startedAt = new Date().toISOString();
    fetchProgress.finishedAt = null;

    // Start fetching in background
    (async () => {
      for (let battleId = parsedFromId; battleId <= parsedToId; battleId++) {
        fetchProgress.current = battleId - parsedFromId + 1;
        try {
          if (fetchProgress.current === 1 || fetchProgress.current % 10 === 0 || fetchProgress.current === total) {
            console.log(`Fetching battle ${battleId} (${fetchProgress.current}/${fetchProgress.total})...`);
          }
          await fetchAndSaveBattle(battleId, apiKey);
          fetchProgress.completedCount += 1;
        } catch (error) {
          console.log(`Failed to fetch battle ${battleId}:`, error.message);
          fetchProgress.failedCount += 1;
          pushFailed({ id: battleId, error: error.message });
          fetchProgress.lastError = error.message;
        }

        if (FETCH_RANGE_DELAY_MS > 0 && battleId < parsedToId) {
          await sleep(FETCH_RANGE_DELAY_MS);
        }
      }

      fetchProgress.isRunning = false;
      fetchProgress.finishedAt = new Date().toISOString();
      console.log(
        `Range fetch completed. Success: ${fetchProgress.completedCount}, Failed: ${fetchProgress.failedCount}`,
      );
    })().catch((error) => {
      fetchProgress.isRunning = false;
      fetchProgress.lastError = error.message;
      fetchProgress.finishedAt = new Date().toISOString();
      console.log("Range fetch crashed:", error.message);
    });

    res.json({
      success: true,
      message: `Started fetching battles from ${parsedFromId} to ${parsedToId} (${fetchProgress.total} battles, delay ${FETCH_RANGE_DELAY_MS}ms)`,
    });
  } catch (error) {
    console.log("Error starting range fetch:", error.message);
    fetchProgress.isRunning = false;
    fetchProgress.finishedAt = new Date().toISOString();
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
      completedCount: fetchProgress.completedCount,
      failedCount: fetchProgress.failedCount,
      failed: fetchProgress.failed,
      lastError: fetchProgress.lastError,
      startedAt: fetchProgress.startedAt,
      finishedAt: fetchProgress.finishedAt,
    },
  });
});

/**
 * GET /api/battles/auto-sync/status
 * Get background battle auto-sync status
 */
router.get("/auto-sync/status", (req, res) => {
  res.json({ success: true, data: getBattleAutoSyncStatus() });
});

/**
 * POST /api/battles/auto-sync/run
 * Run one background battle auto-sync tick immediately
 * Body: { apiKey?: string }
 */
router.post("/auto-sync/run", async (req, res) => {
  try {
    const result = await runBattleAutoSyncOnce({ apiKey: req.body?.apiKey });
    res.json({ success: true, data: result });
  } catch (error) {
    console.log("Error running battle auto sync:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
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
 * POST /api/battles/daily-summary
 * Get player hit totals for a UTC server day based on hit timestamps
 * Body: { date: "YYYY-MM-DD" }
 */
router.post("/daily-summary", async (req, res) => {
  try {
    const { date } = req.body || {};
    const dateKey = String(date || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ success: false, error: "date must be in YYYY-MM-DD format" });
    }

    const summary = await getDailyHitSummary(dateKey);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.log("Error getting daily summary:", error.message);
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
