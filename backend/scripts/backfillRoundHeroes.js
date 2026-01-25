import "dotenv/config";
import pool from "../src/config/database.js";
import { fetchWarRounds } from "../src/services/eclesiarApi.js";

const API_KEY = process.env.ECLESIAR_API_KEY;

if (!API_KEY) {
  console.error("Brak zmiennej ECLESIAR_API_KEY – ustaw ją i uruchom ponownie.");
  process.exit(1);
}

async function main() {
  const [battles] = await pool.query(
    `
    SELECT DISTINCT battle_id
    FROM rounds
    WHERE attackers_hero IS NULL OR defenders_hero IS NULL
    ORDER BY battle_id DESC
  `,
  );

  if (!battles.length) {
    console.log("Brak rund wymagających uzupełnienia hero.");
    process.exit(0);
  }

  console.log(`Do uzupełnienia: ${battles.length} bitew.`);

  let updatedRounds = 0;

  for (const { battle_id: battleId } of battles) {
    try {
      const rounds = await fetchWarRounds(battleId, API_KEY);
      if (!rounds?.length) {
        console.warn(`Brak rund z API dla bitwy ${battleId}, pomijam.`);
        continue;
      }

      for (const round of rounds) {
        const attackersHero = round.attackers_hero ?? null;
        const defendersHero = round.defenders_hero ?? null;

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

        if (result.affectedRows > 0) {
          updatedRounds += result.affectedRows;
        }
      }

      console.log(`✅ Bitwa ${battleId}: uzupełniono hero w ${rounds.length} rundach.`);
    } catch (error) {
      console.error(`❌ Błąd podczas uzupełniania bitwy ${battleId}:`, error.message);
    }
  }

  console.log(`Zakończono. Zaktualizowano hero w ${updatedRounds} rundach.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Nieoczekiwany błąd:", error);
  process.exit(1);
});
