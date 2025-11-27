import pool from "../config/database.js";
import { fetchWars, fetchWarRounds, fetchRoundHits, fetchAccount } from "./eclesiarApi.js";

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

  // Save battle to database
  await pool.query(
    `
    INSERT INTO battles (id, attacker_id, attacker_name, attacker_avatar, 
                         defender_id, defender_name, defender_avatar,
                         region_id, region_name, attackers_score, defenders_score, is_revolution)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      attacker_name = VALUES(attacker_name),
      attacker_avatar = VALUES(attacker_avatar),
      defender_name = VALUES(defender_name),
      defender_avatar = VALUES(defender_avatar),
      attackers_score = VALUES(attackers_score),
      defenders_score = VALUES(defenders_score),
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
    ]
  );

  // Fetch and save rounds
  const rounds = await fetchWarRounds(battleId, apiKey);
  console.log(`Fetched ${rounds.length} rounds for battle ${battleId}`);

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

/**
 * Get war summary for selected battles
 * @param {Array<number>} battleIds - List of battle IDs
 * @returns {Promise<Array>} - Summary with player damage totals
 */
export async function getWarSummary(battleIds) {
  if (!battleIds || battleIds.length === 0) {
    return [];
  }

  console.log("getWarSummary called with battleIds:", battleIds.slice(0, 10), "... (total:", battleIds.length, ")");

  // First check if we have any hits at all
  const [hitsCount] = await pool.query("SELECT COUNT(*) as count FROM hits");
  console.log("Total hits in database:", hitsCount[0].count);

  // Check rounds for these battles
  const [roundsCount] = await pool.query("SELECT COUNT(*) as count FROM rounds WHERE battle_id IN (?)", [battleIds]);
  console.log("Rounds for selected battles:", roundsCount[0].count);

  // Check hits for these rounds
  const [hitsForBattles] = await pool.query(
    `SELECT COUNT(*) as count FROM hits h 
     JOIN rounds r ON h.round_id = r.id 
     WHERE r.battle_id IN (?)`,
    [battleIds]
  );
  console.log("Hits for selected battles:", hitsForBattles[0].count);

  // Aggregate totals per fighter
  const [playerTotals] = await pool.query(
    `
    SELECT 
      h.fighter_id,
      p.name as player_name,
      p.avatar as player_avatar,
      SUM(h.damage) as total_damage,
      COUNT(*) as hit_count
    FROM hits h
    JOIN rounds r ON h.round_id = r.id
    LEFT JOIN players p ON h.fighter_id = p.id
    WHERE r.battle_id IN (?)
    GROUP BY h.fighter_id
    ORDER BY total_damage DESC
  `,
    [battleIds]
  );

  // Determine side based on the first battle (lowest battle_id, then earliest hit) where the fighter appears
  const [firstSides] = await pool.query(
    `
    SELECT
      fighter_id,
      SUBSTRING_INDEX(
        MIN(
          CONCAT(
            LPAD(r.battle_id, 10, '0'),
            '|',
            COALESCE(DATE_FORMAT(h.created_at, '%Y%m%d%H%i%s'), '00000000000000'),
            '|',
            h.side
          )
        ),
        '|',
        -1
      ) AS side
    FROM hits h
    JOIN rounds r ON h.round_id = r.id
    WHERE r.battle_id IN (?) AND h.side IS NOT NULL
    GROUP BY fighter_id
  `,
    [battleIds]
  );

  const sideLookup = new Map(firstSides.map((row) => [row.fighter_id, row.side]));

  const summaryRows = playerTotals.map((player) => ({
    ...player,
    side: sideLookup.get(player.fighter_id) || "UNKNOWN",
  }));

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
