import pool from "../config/database.js";
import { fetchWars, fetchWarRounds, fetchRoundHits, fetchAccount } from "./eclesiarApi.js";
import { getItemName } from "../config/itemMapping.js";

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
    ]
  );

  // Save rounds to database
  for (const round of rounds) {
    await pool.query(
      `
      INSERT INTO rounds (id, battle_id, end_date, attackers_score, defenders_score, 
                          attackers_points, defenders_points)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        attackers_score = VALUES(attackers_score),
        defenders_score = VALUES(defenders_score),
        attackers_points = VALUES(attackers_points),
        defenders_points = VALUES(defenders_points),
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
      ]
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
        [hitValues]
      );

      // Cache player info for unique fighter IDs
      const uniqueFighterIds = [...new Set(hits.map((h) => h.fighter.id))];
      await cachePlayerInfo(uniqueFighterIds, apiKey);
    }
  }

  return war;
}

/**
 * Cache player info from API
 * @param {Array<number>} playerIds - List of player IDs
 */
async function cachePlayerInfo(playerIds, apiKey) {
  for (const playerId of playerIds) {
    try {
      // Check if player already cached (within last 24 hours)
      const [existing] = await pool.query(
        "SELECT id FROM players WHERE id = ? AND updated_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)",
        [playerId]
      );

      if (existing.length === 0) {
        const account = await fetchAccount(playerId, apiKey);
        await pool.query(
          `
          INSERT INTO players (id, name, avatar)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            avatar = VALUES(avatar),
            updated_at = CURRENT_TIMESTAMP
        `,
          [account.id, account.username, account.avatar]
        );
      }
    } catch (error) {
      console.log(`Failed to cache player ${playerId}:`, error.message);
    }
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
const BATCH_SIZE = 50;

/**
 * Get war summary for selected battles using batching
 * Processes battles in batches to prevent server overload while allowing unlimited selection
 * @param {Array<number>} battleIds - List of battle IDs
 * @returns {Promise<Array>} - Summary with player damage totals
 */
export async function getWarSummary(battleIds) {
  if (!battleIds || battleIds.length === 0) {
    return [];
  }

  console.log(`getWarSummary called with ${battleIds.length} battles (processing in batches of ${BATCH_SIZE})`);

  // Master map to accumulate results across all batches
  const playerMap = new Map();

  // Process battles in batches
  const totalBatches = Math.ceil(battleIds.length / BATCH_SIZE);
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, battleIds.length);
    const batchIds = battleIds.slice(start, end);
    
    console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (battles ${start + 1}-${end})`);

    // Create placeholders for parameterized query
    const placeholders = batchIds.map(() => "?").join(",");

    // Combined query: Get player totals, weapon breakdown, and side in a single pass
    const [combinedData] = await pool.query(
      `
      SELECT 
        h.fighter_id,
        p.name as player_name,
        p.avatar as player_avatar,
        h.item_id,
        h.side,
        SUM(h.damage) as damage,
        COUNT(*) as hits,
        MIN(CONCAT(LPAD(r.battle_id, 10, '0'), '|', COALESCE(DATE_FORMAT(h.created_at, '%Y%m%d%H%i%s'), '00000000000000'))) as first_hit
      FROM hits h
      JOIN rounds r ON h.round_id = r.id
      LEFT JOIN players p ON h.fighter_id = p.id
      WHERE r.battle_id IN (${placeholders})
      GROUP BY h.fighter_id, p.name, p.avatar, h.item_id, h.side
      ORDER BY h.fighter_id
      `,
      batchIds
    );

    // Merge batch results into master map
    for (const row of combinedData) {
      const fighterId = row.fighter_id;
      
      if (!playerMap.has(fighterId)) {
        playerMap.set(fighterId, {
          fighter_id: fighterId,
          player_name: row.player_name,
          player_avatar: row.player_avatar,
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
  }

  // Convert to array and sort by total damage
  const summaryRows = Array.from(playerMap.values())
    .map((player) => ({
      fighter_id: player.fighter_id,
      player_name: player.player_name,
      player_avatar: player.player_avatar,
      total_damage: player.total_damage,
      hit_count: player.hit_count,
      side: player._firstHitSide || "UNKNOWN",
      weapons: player.weapons,
    }))
    .sort((a, b) => b.total_damage - a.total_damage);

  console.log("Summary rows returned:", summaryRows.length);
  return summaryRows;
}

/**
 * Delete a battle and all related data
 * @param {number} battleId - Battle ID
 */
export async function deleteBattle(battleId) {
  await pool.query("DELETE FROM battles WHERE id = ?", [battleId]);
}
