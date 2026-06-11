import pool from "../config/database.js";
import { fetchWars } from "./eclesiarApi.js";
import { fetchAndSaveBattle, fetchAndSaveCurrentRound } from "./battleService.js";

const enabled = String(process.env.WARS_AUTO_SYNC_ENABLED || "false").toLowerCase() === "true";
const intervalMs = Math.max(10000, Number(process.env.WARS_AUTO_SYNC_INTERVAL_MS || 60000));
const listLimit = Math.max(1, Number(process.env.WARS_AUTO_SYNC_LIST_LIMIT || 100));
const listPageLimit = Math.max(1, Number(process.env.WARS_AUTO_SYNC_LIST_PAGE_LIMIT || 10));
const delayMs = Math.max(0, Number(process.env.WARS_AUTO_SYNC_DELAY_MS || 500));
const includeExpired = String(process.env.WARS_AUTO_SYNC_INCLUDE_EXPIRED || "true").toLowerCase() !== "false";
const fullFetchCompleted = String(process.env.WARS_AUTO_SYNC_FULL_FETCH_COMPLETED || "true").toLowerCase() !== "false";
const fullFetchActiveIntervalMs = Math.max(0, Number(process.env.WARS_AUTO_SYNC_FULL_FETCH_ACTIVE_INTERVAL_MS || 900000));

let timerId = null;

const status = {
  enabled,
  running: false,
  tickCount: 0,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  currentBattleId: null,
  lastActiveFullFetchAt: null,
  lastResult: null,
  config: {
    intervalMs,
    listLimit,
    listPageLimit,
    delayMs,
    includeExpired,
    fullFetchCompleted,
    fullFetchActiveIntervalMs,
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWarsResponse(wars) {
  if (Array.isArray(wars)) {
    return wars;
  }
  if (wars && typeof wars === "object") {
    return [wars];
  }
  return [];
}

function markWars(wars, expired) {
  return wars.map((war) => ({ ...war, __autoSyncExpired: expired }));
}

function uniqueWars(warLists) {
  const map = new Map();

  warLists.flat().forEach((war) => {
    const id = Number(war?.id);
    if (Number.isInteger(id) && id > 0 && !map.has(id)) {
      map.set(id, war);
    }
  });

  return [...map.values()].slice(0, listLimit);
}

function isCompleteWarPayload(war) {
  return war?.__autoSyncExpired === true;
}

function hasCompleteDbStats(battle) {
  return !!battle && Number(battle.rounds_count) >= 9 && Number(battle.hits_count) > 0;
}

function shouldRunActiveFullFetch(options = {}) {
  if (options.forceActiveFullFetch) {
    return true;
  }

  if (fullFetchActiveIntervalMs <= 0) {
    return false;
  }

  if (!status.lastActiveFullFetchAt) {
    return true;
  }

  const elapsedMs = Date.now() - new Date(status.lastActiveFullFetchAt).getTime();
  return elapsedMs >= fullFetchActiveIntervalMs;
}

async function fetchWarsUntilLimit(params, expired, apiKey) {
  const collectedWars = [];

  for (let page = 1; page <= listPageLimit && collectedWars.length < listLimit; page++) {
    const pageWars = normalizeWarsResponse(await fetchWars({ ...params, page }, apiKey));

    if (!pageWars.length) {
      break;
    }

    collectedWars.push(...markWars(pageWars, expired));

    if (pageWars.length === 1 && Number(pageWars[0]?.id) === Number(params?.war_id)) {
      break;
    }
  }

  return collectedWars;
}

async function getDbStatsByBattleId(battleIds) {
  if (!battleIds.length) {
    return new Map();
  }

  const placeholders = battleIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `
    SELECT
      b.id,
      b.attackers_score,
      b.defenders_score,
      (SELECT COUNT(*) FROM rounds r WHERE r.battle_id = b.id) as rounds_count,
      (SELECT COUNT(*) FROM hits h JOIN rounds r ON h.round_id = r.id WHERE r.battle_id = b.id) as hits_count
    FROM battles b
    WHERE b.id IN (${placeholders})
  `,
    battleIds,
  );

  return new Map(rows.map((row) => [Number(row.id), row]));
}

async function fetchRecentWars(apiKey) {
  const activeWars = await fetchWarsUntilLimit({ expired: 0 }, false, apiKey);

  if (!includeExpired) {
    return uniqueWars([activeWars]);
  }

  try {
    const expiredWars = await fetchWarsUntilLimit({ expired: 1 }, true, apiKey);
    return uniqueWars([activeWars, expiredWars]);
  } catch (error) {
    console.log("WARS auto sync could not fetch expired wars:", error.message);
    return uniqueWars([activeWars]);
  }
}

async function syncWar(war, dbStats, apiKey, options = {}) {
  const battleId = Number(war.id);
  const dbBattle = dbStats.get(battleId);
  const completeInApi = isCompleteWarPayload(war);
  const completeInDb = hasCompleteDbStats(dbBattle);
  const shouldFullFetchActive = options.fullFetchActive === true;

  if (completeInApi) {
    if (!fullFetchCompleted || completeInDb) {
      return { battleId, action: "skip-complete", completeInDb };
    }

    await fetchAndSaveBattle(battleId, apiKey);
    return { battleId, action: "fetch-full", completeInDb };
  }

  if (shouldFullFetchActive) {
    await fetchAndSaveBattle(battleId, apiKey);
    return { battleId, action: "fetch-full-active", completeInDb };
  }

  await fetchAndSaveCurrentRound(battleId, apiKey);
  return { battleId, action: "fetch-current-round", completeInDb };
}

export function getBattleAutoSyncStatus() {
  return { ...status };
}

export async function runBattleAutoSyncOnce(options = {}) {
  if (status.running) {
    return {
      skipped: true,
      reason: "Auto sync is already running.",
      startedAt: status.lastStartedAt,
    };
  }

  const apiKey = options.apiKey || process.env.ECLESIAR_API_KEY;
  if (!apiKey) {
    throw new Error("WARS auto sync needs ECLESIAR_API_KEY or an apiKey option.");
  }

  status.running = true;
  status.tickCount += 1;
  status.lastStartedAt = new Date().toISOString();
  status.lastFinishedAt = null;
  status.lastError = null;
  status.currentBattleId = null;

  const result = {
    checked: 0,
    currentRoundFetched: 0,
    fullFetched: 0,
    activeFullFetched: 0,
    skipped: 0,
    failed: 0,
    warsDiscovered: 0,
    activeFullRefreshTriggered: false,
    errors: [],
  };

  try {
    const wars = await fetchRecentWars(apiKey);
    const fullFetchActive = shouldRunActiveFullFetch(options);
    result.activeFullRefreshTriggered = fullFetchActive;
    result.warsDiscovered = wars.length;
    const battleIds = wars.map((war) => Number(war.id)).filter((id) => Number.isInteger(id) && id > 0);
    const dbStats = await getDbStatsByBattleId(battleIds);

    for (const war of wars) {
      const battleId = Number(war.id);
      status.currentBattleId = battleId;
      result.checked += 1;

      try {
        const syncResult = await syncWar(war, dbStats, apiKey, { fullFetchActive });

        if (syncResult.action === "fetch-current-round") {
          result.currentRoundFetched += 1;
        } else if (syncResult.action === "fetch-full-active") {
          result.activeFullFetched += 1;
        } else if (syncResult.action === "fetch-full") {
          result.fullFetched += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.failed += 1;
        result.errors.push({ battleId, error: error.message });
        console.log(`WARS auto sync failed for battle ${battleId}:`, error.message);
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    if (fullFetchActive) {
      status.lastActiveFullFetchAt = new Date().toISOString();
    }

    status.lastResult = result;
    return result;
  } catch (error) {
    status.lastError = error.message;
    throw error;
  } finally {
    status.running = false;
    status.currentBattleId = null;
    status.lastFinishedAt = new Date().toISOString();
  }
}

export function startBattleAutoSync() {
  if (!enabled) {
    console.log("WARS auto sync disabled. Set WARS_AUTO_SYNC_ENABLED=true to enable it.");
    return;
  }

  if (timerId) {
    return;
  }

  if (!process.env.ECLESIAR_API_KEY) {
    console.log("WARS auto sync disabled because ECLESIAR_API_KEY is missing.");
    status.lastError = "ECLESIAR_API_KEY is missing.";
    return;
  }

  const runTick = () => {
    runBattleAutoSyncOnce().catch((error) => {
      status.lastError = error.message;
      console.log("WARS auto sync tick failed:", error.message);
    });
  };

  console.log(`WARS auto sync enabled. Interval: ${intervalMs}ms, list limit: ${listLimit}, active full refresh interval: ${fullFetchActiveIntervalMs}ms.`);
  runTick();
  timerId = setInterval(runTick, intervalMs);
}
