export function buildCountryStats(country, allPlayers, normalizeCountryKey) {
  if (!country?.country_name && !country?.display_name) {
    return null;
  }

  const sourceCountryName = country.country_name || country.display_name;
  const countryKey = normalizeCountryKey(sourceCountryName);
  const players = allPlayers
    .filter((player) => normalizeCountryKey(player.country_name) === countryKey)
    .map((player) => ({
      ...player,
      display_name: player.player_name || `Player #${player.fighter_id}`,
      total_damage: Number(player.total_damage) || 0,
      hit_count: Number(player.hit_count) || 0,
    }))
    .sort((a, b) => b.total_damage - a.total_damage);

  if (!players.length) {
    return null;
  }

  const totalDamage = players.reduce((sum, player) => sum + player.total_damage, 0);
  const totalHits = players.reduce((sum, player) => sum + player.hit_count, 0);
  const playerCount = players.length;
  const damageValues = players.map((player) => player.total_damage).sort((a, b) => a - b);
  const sideCounts = players.reduce(
    (acc, player) => {
      if (player.side === "ATTACKER") acc.attackers += 1;
      else if (player.side === "DEFENDER") acc.defenders += 1;
      else acc.mixed += 1;
      return acc;
    },
    { attackers: 0, defenders: 0, mixed: 0 },
  );

  const runningDamage = { value: 0 };
  const topContributors = players.map((player) => {
    const damageShare = totalDamage > 0 ? (player.total_damage / totalDamage) * 100 : 0;
    const hitsShare = totalHits > 0 ? (player.hit_count / totalHits) * 100 : 0;
    runningDamage.value += player.total_damage;
    const cumulativeDamage = totalDamage > 0 ? (runningDamage.value / totalDamage) * 100 : 0;

    return {
      ...player,
      damageShare,
      hitsShare,
      cumulativeDamage,
    };
  });

  function playersNeededFor(percentage) {
    return topContributors.findIndex((player) => player.cumulativeDamage >= percentage) + 1 || playerCount;
  }

  function shareOfTop(count) {
    if (totalDamage === 0) {
      return 0;
    }
    const topDamage = topContributors.slice(0, count).reduce((sum, player) => sum + player.total_damage, 0);
    return (topDamage / totalDamage) * 100;
  }

  function shareOfBottom(count) {
    if (totalDamage === 0) {
      return 0;
    }
    const bottomDamage = topContributors
      .slice(Math.max(0, topContributors.length - count))
      .reduce((sum, player) => sum + player.total_damage, 0);
    return (bottomDamage / totalDamage) * 100;
  }

  const tracePlayers = topContributors.filter((player) => player.damageShare > 0 && player.damageShare < 0.1);
  const marginalPlayers = topContributors.filter((player) => player.damageShare > 0 && player.damageShare < 0.5);
  const lowImpactPlayers = topContributors.filter((player) => player.damageShare > 0 && player.damageShare < 1);
  const zeroDamagePlayers = topContributors.filter((player) => player.total_damage <= 0);

  let performanceLabel = "Balanced";
  let performanceTone = "emerald";
  let performanceDescription = "Damage is distributed across a healthy part of the roster.";

  if (shareOfTop(1) >= 45 || shareOfTop(5) >= 85) {
    performanceLabel = "Top-heavy carry";
    performanceTone = "rose";
    performanceDescription = "A tiny part of the roster is carrying most of the total output.";
  } else if (lowImpactPlayers.length >= Math.ceil(playerCount * 0.55) || shareOfBottom(Math.ceil(playerCount / 2)) <= 10) {
    performanceLabel = "Long-tail heavy";
    performanceTone = "amber";
    performanceDescription = "Many players appeared, but most of the back half contributed very little damage.";
  } else if (shareOfTop(10) <= 55 && playersNeededFor(75) >= Math.ceil(playerCount * 0.35)) {
    performanceLabel = "Deep roster";
    performanceTone = "cyan";
    performanceDescription = "The country needed a broad slice of the roster to build its total damage.";
  }

  return {
    country,
    players: topContributors,
    totalDamage,
    totalHits,
    playerCount,
    averageDamage: playerCount ? totalDamage / playerCount : 0,
    medianDamage:
      playerCount % 2 === 1
        ? damageValues[Math.floor(playerCount / 2)]
        : (damageValues[playerCount / 2 - 1] + damageValues[playerCount / 2]) / 2,
    top1Share: shareOfTop(1),
    top3Share: shareOfTop(3),
    top5Share: shareOfTop(5),
    playersFor50: playersNeededFor(50),
    playersFor75: playersNeededFor(75),
    playersFor90: playersNeededFor(90),
    playersAbove1Pct: topContributors.filter((player) => player.damageShare >= 1).length,
    playersAbove5Pct: topContributors.filter((player) => player.damageShare >= 5).length,
    playersAbove10Pct: topContributors.filter((player) => player.damageShare >= 10).length,
    zeroDamagePlayers: zeroDamagePlayers.length,
    tracePlayers: tracePlayers.length,
    marginalPlayers: marginalPlayers.length,
    lowImpactPlayers: lowImpactPlayers.length,
    bottomHalfShare: shareOfBottom(Math.ceil(playerCount / 2)),
    bottomQuarterShare: shareOfBottom(Math.ceil(playerCount / 4)),
    tailShareOutsideTop10: 100 - shareOfTop(Math.min(10, playerCount)),
    performanceLabel,
    performanceTone,
    performanceDescription,
    sideCounts,
  };
}
