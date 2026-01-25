import pool from "../config/database.js";
import { fetchWars, fetchWarRounds, fetchRoundHits, fetchAccount } from "./eclesiarApi.js";
import { getItemName } from "../config/itemMapping.js";

function extractHeroId(hero) {
  if (!hero) {
    return null;
  }

  if (typeof hero === "number") {
    return hero;
  }

  if (typeof hero === "object" && hero.id) {
    return hero.id;
  }

  return null;
}

/**
 * Get all battles from database
 * @returns {Promise<Array>} - List of battles
 */
export async function getAllBattles() {
  const [rows] = await pool.query(`
    SELECT 
      b.*,
      (SELECT COUNT(*) FROM rounds r WHERE r.battle_id = b.id) as rounds_count,
      (SELECT COUNT(*) FROM hits h 
       JOIN rounds r ON h.round_id = r.id 
       WHERE r.battle_id = b.id) as hits_count
    FROM battles b
    ORDER BY b.fetched_at DESC
  `);
  return rows;
}

/**
 * Backfill attackers_hero/defenders_hero for existing rounds
 * @param {string} apiKey - Optional API key, falls back to process.env.ECLESIAR_API_KEY
 * @returns {Promise<{ battlesProcessed: number, updatedRounds: number, skipped: number }>}
 */
export async function backfillRoundHeroes(apiKey) {
  const handlerVersion = "2026-01-25-username-fix";
  const effectiveKey = apiKey || process.env.ECLESIAR_API_KEY;
  if (!effectiveKey) {
    throw new Error("Brak API key – podaj w ciele żądania lub ustaw ECLESIAR_API_KEY.");
  }
  if (!process.env.ECLESIAR_API_URL) {
    throw new Error("Brak ECLESIAR_API_URL w środowisku. Ustaw adres API na produkcji.");
  }

  const [battles] = await pool.query(
    `
    SELECT DISTINCT battle_id
    FROM rounds
    WHERE attackers_hero IS NULL OR defenders_hero IS NULL
    ORDER BY battle_id DESC
  `,
  );

  if (!battles.length) {
    return { battlesProcessed: 0, updatedRounds: 0, skipped: 0, errors: [], handlerVersion };
  }

  let updatedRounds = 0;
  let skippedBattles = 0;
  const errors = [];

  for (const { battle_id: battleId } of battles) {
    try {
      const rounds = await fetchWarRounds(battleId, effectiveKey);
      if (!rounds?.length) {
        skippedBattles += 1;
        errors.push({ battleId, reason: "Brak rund z API" });
        continue;
      }

      for (const round of rounds) {
        const attackersHero = extractHeroId(round.attackers_hero);
        const defendersHero = extractHeroId(round.defenders_hero);

        if (attackersHero === null && defendersHero === null) {
          continue;
        }

        const [result] = await pool.query(
          `
          UPDATE rounds
          SET attackers_hero = ?, defenders_hero = ?, fetched_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [attackersHero, defendersHero, round.id],
        );

        updatedRounds += result.affectedRows;
      }
    } catch (error) {
      console.error(`Backfill hero error for battle ${battleId}:`, error.message);
      skippedBattles += 1;
      const sqlMessage = error?.sqlMessage ? `SQL: ${error.sqlMessage}` : null;
      const sql = error?.sql ? `Query: ${error.sql}` : null;
      const reason = [error?.message || "Unknown error", sqlMessage, sql].filter(Boolean).join(" | ");
      errors.push({ battleId, reason });
    }
  }

  return {
    battlesProcessed: battles.length,
    updatedRounds,
    skipped: skippedBattles,
    errors: errors.slice(0, 10),
    handlerVersion,
  };
}

/**
 * Fetch and save a battle from API
 * @param {number} battleId - Battle/War ID
 * @returns {Promise<Object>} - Saved battle data
 */
export async function fetchAndSaveBattle(battleId, apiKey) {
  // Fetch war details
  const warsResponse = await fetchWars({ war_id: battleId }, apiKey);

  // Debug: log the response structure
  console.log(`API response for war ${battleId}:`, JSON.stringify(warsResponse, null, 2));

  // Handle both array and single object responses
  let war;
  if (Array.isArray(warsResponse)) {
    if (warsResponse.length === 0) {
      throw new Error("Battle not found");
    }
    war = warsResponse[0];
  } else if (warsResponse && typeof warsResponse === "object") {
    // API might return single object instead of array
    war = warsResponse;
  } else {
    throw new Error("Invalid API response format");
  }

  // Validate required fields
  if (!war || !war.id) {
    throw new Error("Battle data is missing required fields");
  }
  if (!war.attackers || !war.attackers.id) {
    throw new Error("Battle attackers data is missing");
  }
  if (!war.defenders || !war.defenders.id) {
    throw new Error("Battle defenders data is missing");
  }

  // Fetch rounds first to get end_date from round 9 (last round)
  const rounds = await fetchWarRounds(battleId, apiKey);
  console.log(`Fetched ${rounds.length} rounds for battle ${battleId}`);

  // Get end_date from round 9 (last round) - rounds are sorted by id ascending
  // Round 9 is the last round of the battle
  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const battleEndDate = lastRound?.end_date || null;

  // Do not persist Stadium battles
  if (war.region?.name === "Stadium") {
    console.log(`Skipping save for battle ${battleId} because region_name is Stadium`);
    return war;
  }

  // Cache country info from attacker and defender
  await cacheCountry(war.attackers.id, war.attackers.name, war.attackers.avatar);
  await cacheCountry(war.defenders.id, war.defenders.name, war.defenders.avatar);

  // Save battle to database
  await pool.query(
    `
    INSERT INTO battles (id, attacker_id, attacker_name, attacker_avatar, 
                         defender_id, defender_name, defender_avatar,
                         region_id, region_name, attackers_score, defenders_score, is_revolution, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      attacker_name = VALUES(attacker_name),
      attacker_avatar = VALUES(attacker_avatar),
      defender_name = VALUES(defender_name),
      defender_avatar = VALUES(defender_avatar),
      attackers_score = VALUES(attackers_score),
      defenders_score = VALUES(defenders_score),
      end_date = VALUES(end_date),
      fetched_at = CURRENT_TIMESTAMP
  `,
    [
      war.id,
      war.attackers.id,
      war.attackers.name,
      war.attackers.avatar,
      war.defenders.id,
      war.defenders.name,
      war.defenders.avatar,
      war.region?.id,
      war.region?.name,
      war.attackers_score,
      war.defenders_score,
      war.flags?.is_revolution || 0,
      battleEndDate,
    ],
  );

  // Save rounds to database
  for (const round of rounds) {
    await pool.query(
      `
      INSERT INTO rounds (id, battle_id, end_date, attackers_score, defenders_score, 
                          attackers_points, defenders_points, attackers_hero, defenders_hero)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        attackers_score = VALUES(attackers_score),
        defenders_score = VALUES(defenders_score),
        attackers_points = VALUES(attackers_points),
        defenders_points = VALUES(defenders_points),
        attackers_hero = VALUES(attackers_hero),
        defenders_hero = VALUES(defenders_hero),
        fetched_at = CURRENT_TIMESTAMP
    `,
      [
        round.id,
        battleId,
        round.end_date,
        round.attackers_score,
        round.defenders_score,
        round.attackers_points,
        round.defenders_points,
        extractHeroId(round.attackers_hero),
        extractHeroId(round.defenders_hero),
      ],
    );

    // Fetch and save hits for this round
    const hits = await fetchRoundHits(round.id, apiKey);
    console.log(`Fetched ${hits.length} hits for round ${round.id}`);

    // Delete existing hits for this round to avoid duplicates
    await pool.query("DELETE FROM hits WHERE round_id = ?", [round.id]);

    // Batch insert hits
    if (hits.length > 0) {
      const hitValues = hits.map((hit) => [
        round.id,
        hit.fighter.id,
        hit.fighter.type,
        hit.damage,
        normalizeHitSide(hit.side),
        hit.item_id,
        hit.created_at,
      ]);

      await pool.query(
        `
        INSERT INTO hits (round_id, fighter_id, fighter_type, damage, side, item_id, created_at)
        VALUES ?
      `,
        [hitValues],
      );

      // Cache player info for unique fighter IDs
      const uniqueFighterIds = [...new Set(hits.map((h) => h.fighter.id))];
      await cachePlayerInfo(uniqueFighterIds, apiKey);
    }
  }

  return war;
}

/**
 * Cache player info from API (including nationality_id)
 * @param {Array<number>} playerIds - List of player IDs
 * @param {string} apiKey - API key for requests
 */
async function cachePlayerInfo(playerIds, apiKey) {
  for (const playerId of playerIds) {
    try {
      // Check if player already cached with nationality (within last 24 hours)
      const [existing] = await pool.query(
        "SELECT id, nationality_id FROM players WHERE id = ? AND updated_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)",
        [playerId],
      );

      // Fetch if not cached or missing nationality_id
      if (existing.length === 0 || existing[0].nationality_id === null) {
        const account = await fetchAccount(playerId, apiKey);
        await pool.query(
          `
          INSERT INTO players (id, name, avatar, nationality_id)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            avatar = VALUES(avatar),
            nationality_id = VALUES(nationality_id),
            updated_at = CURRENT_TIMESTAMP
        `,
          [account.id, account.username ?? account.name, account.avatar, account.nationality_id || null],
        );
      }
    } catch (error) {
      console.log(`Failed to cache player ${playerId}:`, error.message);
    }
  }
}

/**
 * Cache country info from battle data (attacker/defender are countries)
 * @param {number} countryId - Country ID
 * @param {string} name - Country name
 * @param {string} avatar - Country avatar URL
 */
async function cacheCountry(countryId, name, avatar) {
  try {
    await pool.query(
      `
      INSERT INTO countries (id, name, avatar)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        avatar = VALUES(avatar),
        updated_at = CURRENT_TIMESTAMP
    `,
      [countryId, name, avatar],
    );
  } catch (error) {
    console.log(`Failed to cache country ${countryId}:`, error.message);
  }
}

function normalizeHitSide(rawSide) {
  if (rawSide === null || rawSide === undefined) {
    return null;
  }

  if (typeof rawSide === "number") {
    if (rawSide === 1) return "ATTACKER";
    if (rawSide === 0) return "DEFENDER";
  }

  if (typeof rawSide === "boolean") {
    return rawSide ? "ATTACKER" : "DEFENDER";
  }

  const sideString = String(rawSide).trim().toUpperCase();
  if (!sideString) {
    return null;
  }

  if (sideString === "1" || sideString.startsWith("ATTACK") || sideString === "A") {
    return "ATTACKER";
  }

  if (sideString === "0" || sideString.startsWith("DEFEND") || sideString === "D") {
    return "DEFENDER";
  }

  return null;
}

// Batch size for processing battles in chunks to prevent memory issues
const BATCH_SIZE = 20;

/**
 * Check if a battle is complete (one side has 5 wins)
 * @param {Object} battle - Battle object with attackers_score and defenders_score
 * @returns {boolean}
 */
function isBattleComplete(battle) {
  return battle.attackers_score >= 5 || battle.defenders_score >= 5;
}

/**
 * Get cached summary for a battle from player_battle_stats table
 * @param {number} battleId - Battle ID
 * @returns {Promise<Array>} - Cached player stats or empty array
 */
async function getCachedBattleSummary(battleId) {
  const [rows] = await pool.query(`SELECT * FROM player_battle_stats WHERE battle_id = ?`, [battleId]);
  return rows;
}

/**
 * Cache battle summary to player_battle_stats table
 * @param {number} battleId - Battle ID
 * @param {Array} playerStats - Array of player stat objects
 */
async function cacheBattleSummary(battleId, playerStats) {
  if (!playerStats || playerStats.length === 0) return;

  // Delete existing cache for this battle
  await pool.query(`DELETE FROM player_battle_stats WHERE battle_id = ?`, [battleId]);

  // Insert new cached stats
  const values = playerStats.map((stat) => [
    battleId,
    stat.fighter_id,
    stat.player_name,
    stat.player_avatar,
    stat.nationality_id || null,
    stat.total_damage,
    stat.hit_count,
    stat.side,
    JSON.stringify(stat.weapons || {}),
  ]);

  if (values.length > 0) {
    await pool.query(
      `INSERT INTO player_battle_stats 
       (battle_id, player_id, player_name, player_avatar, nationality_id, total_damage, hit_count, side, weapons)
       VALUES ?`,
      [values],
    );
    console.log(`Cached summary for battle ${battleId}: ${values.length} players`);
  }
}

/**
 * Calculate summary for a batch of battles (not from cache)
 * @param {Array<number>} battleIds - Battle IDs to calculate
 * @returns {Promise<Map>} - Map of player stats
 */
async function calculateBatchSummary(battleIds) {
  const playerMap = new Map();

  if (battleIds.length === 0) return playerMap;

  const placeholders = battleIds.map(() => "?").join(",");

  // Combined query: Get player totals, weapon breakdown, side, and nationality
  const [combinedData] = await pool.query(
    `
    SELECT 
      h.fighter_id,
      p.name as player_name,
      p.avatar as player_avatar,
      p.nationality_id,
      c.name as country_name,
      c.avatar as country_avatar,
      h.item_id,
      h.side,
      SUM(h.damage) as damage,
      COUNT(*) as hits,
      MIN(CONCAT(LPAD(r.battle_id, 10, '0'), '|', COALESCE(DATE_FORMAT(h.created_at, '%Y%m%d%H%i%s'), '00000000000000'))) as first_hit
    FROM hits h
    JOIN rounds r ON h.round_id = r.id
    LEFT JOIN players p ON h.fighter_id = p.id
    LEFT JOIN countries c ON p.nationality_id = c.id
    WHERE r.battle_id IN (${placeholders})
    GROUP BY h.fighter_id, p.name, p.avatar, p.nationality_id, c.name, c.avatar, h.item_id, h.side
    ORDER BY h.fighter_id
    `,
    battleIds,
  );

  // Merge results into map
  for (const row of combinedData) {
    const fighterId = row.fighter_id;

    if (!playerMap.has(fighterId)) {
      playerMap.set(fighterId, {
        fighter_id: fighterId,
        player_name: row.player_name,
        player_avatar: row.player_avatar,
        nationality_id: row.nationality_id,
        country_name: row.country_name,
        country_avatar: row.country_avatar,
        total_damage: 0,
        hit_count: 0,
        weapons: {},
        // Track first hit for side determination
        _firstHit: row.first_hit,
        _firstHitSide: row.side,
      });
    }

    const player = playerMap.get(fighterId);

    // Accumulate damage and hits
    player.total_damage += Number(row.damage);
    player.hit_count += Number(row.hits);

    // Build weapon breakdown
    const itemName = getItemName(row.item_id);
    if (!player.weapons[itemName]) {
      player.weapons[itemName] = { damage: 0, hits: 0 };
    }
    player.weapons[itemName].damage += Number(row.damage);
    player.weapons[itemName].hits += Number(row.hits);

    // Update first hit tracking for side determination (keep earliest)
    if (row.side && row.first_hit < player._firstHit) {
      player._firstHit = row.first_hit;
      player._firstHitSide = row.side;
    }
  }

  return playerMap;
}

/**
 * Get war summary for selected battles using batching and caching
 * Uses cached summaries for completed battles, calculates fresh for incomplete
 * @param {Array<number>} battleIds - List of battle IDs
 * @returns {Promise<Array>} - Summary with player damage totals and nationality
 */
export async function getWarSummary(battleIds) {
  if (!battleIds || battleIds.length === 0) {
    return [];
  }

  console.log(`getWarSummary called with ${battleIds.length} battles`);

  // Get battle details to determine which are complete vs incomplete
  const placeholders = battleIds.map(() => "?").join(",");
  const [battles] = await pool.query(
    `SELECT id, attackers_score, defenders_score FROM battles WHERE id IN (${placeholders})`,
    battleIds,
  );

  // Separate complete and incomplete battles
  const completeBattleIds = [];
  const incompleteBattleIds = [];

  for (const battle of battles) {
    if (isBattleComplete(battle)) {
      completeBattleIds.push(battle.id);
    } else {
      incompleteBattleIds.push(battle.id);
    }
  }

  console.log(`Complete battles: ${completeBattleIds.length}, Incomplete: ${incompleteBattleIds.length}`);

  // Master map to accumulate results
  const playerMap = new Map();

  // Process complete battles - try to use cache first
  for (const battleId of completeBattleIds) {
    const cachedStats = await getCachedBattleSummary(battleId);

    if (cachedStats.length > 0) {
      // Use cached data
      console.log(`Using cached summary for battle ${battleId}`);
      for (const stat of cachedStats) {
        const fighterId = stat.player_id;

        if (!playerMap.has(fighterId)) {
          // Get country name and avatar for this player
          const [countryRows] = await pool.query(
            `SELECT c.name, c.avatar FROM countries c JOIN players p ON p.nationality_id = c.id WHERE p.id = ?`,
            [fighterId],
          );

          playerMap.set(fighterId, {
            fighter_id: fighterId,
            player_name: stat.player_name,
            player_avatar: stat.player_avatar,
            nationality_id: stat.nationality_id,
            country_name: countryRows[0]?.name || null,
            country_avatar: countryRows[0]?.avatar || null,
            total_damage: 0,
            hit_count: 0,
            weapons: {},
            side: stat.side,
          });
        }

        const player = playerMap.get(fighterId);
        player.total_damage += Number(stat.total_damage);
        player.hit_count += Number(stat.hit_count);

        // Merge weapons
        const weapons = typeof stat.weapons === "string" ? JSON.parse(stat.weapons) : stat.weapons || {};
        for (const [weapon, data] of Object.entries(weapons)) {
          if (!player.weapons[weapon]) {
            player.weapons[weapon] = { damage: 0, hits: 0 };
          }
          player.weapons[weapon].damage += Number(data.damage || 0);
          player.weapons[weapon].hits += Number(data.hits || 0);
        }
      }
    } else {
      // No cache - calculate and then cache
      console.log(`Calculating and caching summary for battle ${battleId}`);
      const batchMap = await calculateBatchSummary([battleId]);

      // Cache the calculated summary
      const statsToCache = Array.from(batchMap.values()).map((p) => ({
        fighter_id: p.fighter_id,
        player_name: p.player_name,
        player_avatar: p.player_avatar,
        nationality_id: p.nationality_id,
        total_damage: p.total_damage,
        hit_count: p.hit_count,
        side: p._firstHitSide || "UNKNOWN",
        weapons: p.weapons,
      }));
      await cacheBattleSummary(battleId, statsToCache);

      // Merge into master map
      for (const [fighterId, stat] of batchMap) {
        if (!playerMap.has(fighterId)) {
          playerMap.set(fighterId, {
            fighter_id: stat.fighter_id,
            player_name: stat.player_name,
            player_avatar: stat.player_avatar,
            nationality_id: stat.nationality_id,
            country_name: stat.country_name,
            country_avatar: stat.country_avatar,
            total_damage: 0,
            hit_count: 0,
            weapons: {},
            side: stat._firstHitSide || "UNKNOWN",
          });
        }

        const player = playerMap.get(fighterId);
        player.total_damage += stat.total_damage;
        player.hit_count += stat.hit_count;

        // Merge weapons
        for (const [weapon, data] of Object.entries(stat.weapons)) {
          if (!player.weapons[weapon]) {
            player.weapons[weapon] = { damage: 0, hits: 0 };
          }
          player.weapons[weapon].damage += data.damage;
          player.weapons[weapon].hits += data.hits;
        }
      }
    }
  }

  // Process incomplete battles in batches (no caching)
  if (incompleteBattleIds.length > 0) {
    const totalBatches = Math.ceil(incompleteBattleIds.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, incompleteBattleIds.length);
      const batchIds = incompleteBattleIds.slice(start, end);

      console.log(`Processing incomplete batch ${batchIndex + 1}/${totalBatches}`);
      const batchMap = await calculateBatchSummary(batchIds);

      // Merge into master map
      for (const [fighterId, stat] of batchMap) {
        if (!playerMap.has(fighterId)) {
          playerMap.set(fighterId, {
            fighter_id: stat.fighter_id,
            player_name: stat.player_name,
            player_avatar: stat.player_avatar,
            nationality_id: stat.nationality_id,
            country_name: stat.country_name,
            country_avatar: stat.country_avatar,
            total_damage: 0,
            hit_count: 0,
            weapons: {},
            side: stat._firstHitSide || "UNKNOWN",
          });
        }

        const player = playerMap.get(fighterId);
        player.total_damage += stat.total_damage;
        player.hit_count += stat.hit_count;

        // Merge weapons
        for (const [weapon, data] of Object.entries(stat.weapons)) {
          if (!player.weapons[weapon]) {
            player.weapons[weapon] = { damage: 0, hits: 0 };
          }
          player.weapons[weapon].damage += data.damage;
          player.weapons[weapon].hits += data.hits;
        }

        // Update side if not set
        if (!player.side || player.side === "UNKNOWN") {
          player.side = stat._firstHitSide || "UNKNOWN";
        }
      }
    }
  }

  // Convert to array and sort by total damage
  const summaryRows = Array.from(playerMap.values())
    .map((player) => ({
      fighter_id: player.fighter_id,
      player_name: player.player_name,
      player_avatar: player.player_avatar,
      nationality_id: player.nationality_id,
      country_name: player.country_name,
      country_avatar: player.country_avatar,
      total_damage: player.total_damage,
      hit_count: player.hit_count,
      side: player.side || "UNKNOWN",
      weapons: player.weapons,
    }))
    .sort((a, b) => b.total_damage - a.total_damage);

  console.log("Summary rows returned:", summaryRows.length);
  return summaryRows;
}

/**
 * Get per-battle details for a single player (damage, hits, battle hero count)
 * @param {Array<number>} battleIds - Selected battle IDs
 * @param {number} playerId - Player ID
 * @returns {Promise<Array>} - Per-battle details
 */
export async function getPlayerBattleDetails(battleIds, playerId) {
  if (!battleIds || battleIds.length === 0 || !playerId) {
    return [];
  }

  const placeholders = battleIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `
    WITH round_progress AS (
      SELECT
        id,
        battle_id,
        SUM(CASE WHEN attackers_points > defenders_points THEN 1 ELSE 0 END)
          OVER (PARTITION BY battle_id ORDER BY id) AS attackers_wins,
        SUM(CASE WHEN defenders_points > attackers_points THEN 1 ELSE 0 END)
          OVER (PARTITION BY battle_id ORDER BY id) AS defenders_wins
      FROM rounds
    ),
    finishing_round AS (
      SELECT battle_id, MIN(id) AS victory_round_id
      FROM round_progress
      WHERE attackers_wins >= 5 OR defenders_wins >= 5
      GROUP BY battle_id
    ),
    hits_by_round AS (
      SELECT round_id, SUM(damage) AS total_damage, COUNT(*) AS hit_count
      FROM hits
      WHERE fighter_id = ?
      GROUP BY round_id
    )
    SELECT
      b.id as battle_id,
      b.attacker_name,
      b.defender_name,
      b.region_name,
      b.end_date,
      COALESCE(SUM(hbr.total_damage), 0) as total_damage,
      COALESCE(
        SUM(
          CASE
            WHEN fr.victory_round_id IS NULL THEN hbr.total_damage
            WHEN r.id <= fr.victory_round_id THEN hbr.total_damage
            ELSE 0
          END
        ),
        0
      ) as damage_before_victory,
      COALESCE(
        SUM(
          CASE
            WHEN fr.victory_round_id IS NULL THEN 0
            WHEN r.id > fr.victory_round_id THEN hbr.total_damage
            ELSE 0
          END
        ),
        0
      ) as damage_after_victory,
      COALESCE(SUM(hbr.hit_count), 0) as hit_count,
      COALESCE(
        SUM(
          CASE
            WHEN r.attackers_hero = ? THEN 1
            WHEN r.defenders_hero = ? THEN 1
            ELSE 0
          END
        ),
        0
      ) as bh_count
    FROM rounds r
    JOIN battles b ON r.battle_id = b.id
    LEFT JOIN finishing_round fr ON fr.battle_id = r.battle_id
    LEFT JOIN hits_by_round hbr ON hbr.round_id = r.id
    WHERE r.battle_id IN (${placeholders})
    GROUP BY b.id, b.attacker_name, b.defender_name, b.region_name, b.end_date
    HAVING total_damage > 0 OR bh_count > 0
    ORDER BY b.id DESC
    `,
    [playerId, playerId, playerId, ...battleIds],
  );

  return rows;
}

/**
 * Delete a battle and all related data
 * @param {number} battleId - Battle ID
 */
export async function deleteBattle(battleId) {
  await pool.query("DELETE FROM battles WHERE id = ?", [battleId]);
}
