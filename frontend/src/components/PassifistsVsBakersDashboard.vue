<script setup>
import { computed, ref, watch } from "vue";
import { getWarSummary } from "../api.js";
import CountryDetailsModal from "./CountryDetailsModal.vue";
import PassifistsVsBakersFrontLog from "./PassifistsVsBakersFrontLog.vue";
import PassifistsVsBakersLeaderboards from "./PassifistsVsBakersLeaderboards.vue";
import PassifistsVsBakersTimeline from "./PassifistsVsBakersTimeline.vue";
import {
  ALLIANCE_TAG_META,
  COALITION_COUNTRIES,
  HOSTILE_COUNTRIES,
  PASSIFISTS_VS_BAKERS_START_DATE,
  getCampaignCountry,
  getCampaignSide,
} from "../constants/passifistsVsBakers.js";
import { buildCountryStats } from "../utils/countryStats.js";

const props = defineProps({
  battles: {
    type: Array,
    required: true,
  },
  loadingBattles: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(["back", "open-player-details"]);

const loadingSummary = ref(false);
const summaryError = ref("");
const campaignSummary = ref([]);
const countryDetailsOpen = ref(false);
const selectedCountry = ref(null);

function formatNumber(num) {
  return (Number(num) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatCompactNumber(num) {
  const value = Number(num) || 0;
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000_000 ? 2 : 1,
  }).format(value);
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

function normalizeCountryKey(value) {
  return String(value || "").trim().toLowerCase();
}

function formatShortDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  return new Date(dateValue).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const today = computed(() => new Date().toISOString().slice(0, 10));

const campaignBattles = computed(() => {
  const start = new Date(`${PASSIFISTS_VS_BAKERS_START_DATE}T00:00:00`);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return props.battles
    .filter((battle) => {
      if (!battle?.end_date) {
        return false;
      }

      const battleDate = new Date(battle.end_date);
      return battleDate >= start && battleDate <= end;
    })
    .sort((a, b) => new Date(b.end_date) - new Date(a.end_date));
});

const campaignBattleIds = computed(() => campaignBattles.value.map((battle) => battle.id));

async function loadCampaignSummary() {
  if (!campaignBattleIds.value.length) {
    campaignSummary.value = [];
    summaryError.value = "";
    return;
  }

  loadingSummary.value = true;
  summaryError.value = "";

  try {
    const response = await getWarSummary(campaignBattleIds.value);
    if (response.success) {
      campaignSummary.value = response.data;
    } else {
      summaryError.value = response.error || "Failed to load campaign summary.";
    }
  } catch (error) {
    summaryError.value = `Failed to load campaign summary: ${error.message}`;
  } finally {
    loadingSummary.value = false;
  }
}

watch(campaignBattleIds, loadCampaignSummary, { immediate: true });

function createTagAccumulator() {
  return Object.keys(ALLIANCE_TAG_META).reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

const countryPerformance = computed(() => {
  const countryMap = new Map();

  campaignSummary.value.forEach((player) => {
    const country = getCampaignCountry(player.country_name);
    if (!country) {
      return;
    }

    if (!countryMap.has(country.name)) {
      countryMap.set(country.name, {
        name: country.name,
        flag: country.flag,
        tags: country.tags,
        side: getCampaignSide(country.name),
        total_damage: 0,
        hit_count: 0,
        player_count: 0,
      });
    }

    const entry = countryMap.get(country.name);
    entry.total_damage += Number(player.total_damage) || 0;
    entry.hit_count += Number(player.hit_count) || 0;
    entry.player_count += 1;
  });

  return Array.from(countryMap.values()).sort((a, b) => b.total_damage - a.total_damage);
});

const sideDamage = computed(() =>
  countryPerformance.value.reduce(
    (acc, country) => {
      if (country.side === "coalition") {
        acc.coalition += country.total_damage;
      } else if (country.side === "hostile") {
        acc.hostile += country.total_damage;
      }
      return acc;
    },
    { coalition: 0, hostile: 0 },
  ),
);

const battleMetrics = computed(() => {
  const coalitionCountriesInWar = new Set();
  const hostileCountriesInWar = new Set();

  const coalitionWins = campaignBattles.value.filter((battle) => {
    if (getCampaignSide(battle.attacker_name) === "coalition") {
      coalitionCountriesInWar.add(battle.attacker_name);
    }
    if (getCampaignSide(battle.defender_name) === "coalition") {
      coalitionCountriesInWar.add(battle.defender_name);
    }
    if (getCampaignSide(battle.attacker_name) === "hostile") {
      hostileCountriesInWar.add(battle.attacker_name);
    }
    if (getCampaignSide(battle.defender_name) === "hostile") {
      hostileCountriesInWar.add(battle.defender_name);
    }

    const coalitionOnAttack = getCampaignSide(battle.attacker_name) === "coalition";
    const coalitionScore = coalitionOnAttack ? Number(battle.attackers_score) || 0 : Number(battle.defenders_score) || 0;
    const hostileScore = coalitionOnAttack ? Number(battle.defenders_score) || 0 : Number(battle.attackers_score) || 0;
    return coalitionScore > hostileScore;
  }).length;

  const totalTrackedDamage = sideDamage.value.coalition + sideDamage.value.hostile;

  return {
    total: campaignBattles.value.length,
    coalitionWins,
    hostileWins: campaignBattles.value.length - coalitionWins,
    activeCoalitionCountries: coalitionCountriesInWar.size,
    activeHostileCountries: hostileCountriesInWar.size,
    totalTrackedDamage,
    coalitionDamageShare: totalTrackedDamage ? (sideDamage.value.coalition / totalTrackedDamage) * 100 : 0,
    hostileDamageShare: totalTrackedDamage ? (sideDamage.value.hostile / totalTrackedDamage) * 100 : 0,
  };
});

const allianceCountryCards = computed(() => [
  {
    title: "Coalition",
    subtitle: "Passifists + APP + URL",
    accent: "emerald",
    countries: COALITION_COUNTRIES,
  },
  {
    title: "Hostile Side",
    subtitle: "The Bakers + affiliates",
    accent: "rose",
    countries: HOSTILE_COUNTRIES,
  },
]);

const tagPerformance = computed(() => {
  const tagMap = createTagAccumulator();

  countryPerformance.value.forEach((country) => {
    country.tags.forEach((tag) => {
      tagMap[tag] += country.total_damage;
    });
  });

  return Object.entries(tagMap)
    .map(([tag, totalDamage]) => ({
      tag,
      meta: ALLIANCE_TAG_META[tag],
      totalDamage,
    }))
    .filter((item) => item.totalDamage > 0)
    .sort((a, b) => b.totalDamage - a.totalDamage);
});

const playerInsights = computed(() => {
  const players = campaignSummary.value
    .map((player) => {
      const country = getCampaignCountry(player.country_name);
      if (!country) {
        return null;
      }

      return {
        ...player,
        side: getCampaignSide(country.name),
        tags: country.tags,
        flag: country.flag,
        display_name: player.player_name || `Player #${player.fighter_id}`,
        total_damage: Number(player.total_damage) || 0,
        hit_count: Number(player.hit_count) || 0,
        bh_count: Number(player.bh_count) || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.total_damage - a.total_damage);

  const totalDamage = players.reduce((sum, player) => sum + player.total_damage, 0);
  const topDamage = players.slice(0, 20).reduce((sum, player) => sum + player.total_damage, 0);

  return {
    players,
    totalDamage,
    impactfulPlayers: players.filter((player) => (totalDamage ? player.total_damage / totalDamage >= 0.01 : false)).length,
    heavyLifters: players.filter((player) => (totalDamage ? player.total_damage / totalDamage >= 0.05 : false)).length,
    top20Share: totalDamage ? (topDamage / totalDamage) * 100 : 0,
    top1Share: totalDamage && players[0] ? (players[0].total_damage / totalDamage) * 100 : 0,
  };
});

function buildSideParticipationMetrics(sideKey, label, accent) {
  const players = playerInsights.value.players.filter((player) => player.side === sideKey);
  const totalDamage = players.reduce((sum, player) => sum + player.total_damage, 0);
  const sortedPlayers = [...players].sort((a, b) => b.total_damage - a.total_damage);

  let cumulativeDamage = 0;
  let playersFor50 = 0;

  sortedPlayers.forEach((player, index) => {
    cumulativeDamage += player.total_damage;
    if (!playersFor50 && totalDamage > 0 && cumulativeDamage / totalDamage >= 0.5) {
      playersFor50 = index + 1;
    }
  });

  return {
    sideKey,
    label,
    accent,
    totalPlayers: players.length,
    totalDamage,
    tracePlayers: players.filter((player) => (totalDamage ? player.total_damage / totalDamage < 0.001 : false)).length,
    lowImpactPlayers: players.filter((player) => (totalDamage ? player.total_damage / totalDamage < 0.01 : false)).length,
    supportPlayers: players.filter((player) => (totalDamage ? player.total_damage / totalDamage >= 0.001 : false)).length,
    significantPlayers: players.filter((player) => (totalDamage ? player.total_damage / totalDamage >= 0.01 : false)).length,
    coreContributors: players.filter((player) => (totalDamage ? player.total_damage / totalDamage >= 0.005 : false)).length,
    playersFor50: playersFor50 || 0,
    avgDamage: players.length ? totalDamage / players.length : 0,
  };
}

const participationCards = computed(() => {
  const coalition = buildSideParticipationMetrics("coalition", "Coalition", "emerald");
  const hostile = buildSideParticipationMetrics("hostile", "Hostile", "rose");
  const totalPlayers = coalition.totalPlayers + hostile.totalPlayers;
  const totalDamage = coalition.totalDamage + hostile.totalDamage;

  return [
    {
      label: "All tracked players",
      value: totalPlayers,
      note: `${coalition.totalPlayers} coalition vs ${hostile.totalPlayers} hostile`,
      tone: "slate",
    },
    {
      label: "Numerical edge",
      value:
        coalition.totalPlayers === hostile.totalPlayers
          ? "Even"
          : coalition.totalPlayers > hostile.totalPlayers
            ? `Coalition +${coalition.totalPlayers - hostile.totalPlayers}`
            : `Hostile +${hostile.totalPlayers - coalition.totalPlayers}`,
      note: "Raw headcount of unique players in tracked countries.",
      tone: "slate",
    },
    {
      label: "Meaningful contributors",
      value: coalition.significantPlayers + hostile.significantPlayers,
      note: "Players with at least 1% of their side's tracked damage.",
      tone: "cyan",
    },
    {
      label: "Active core",
      value:
        totalDamage > 0
          ? `${formatPercent(((coalition.coreContributors + hostile.coreContributors) / Math.max(1, totalPlayers)) * 100)}`
          : "0.0%",
      note: "Share of roster made of players doing at least 0.5% of their side's damage.",
      tone: "amber",
    },
  ];
});

const sideParticipation = computed(() => [
  buildSideParticipationMetrics("coalition", "Coalition", "emerald"),
  buildSideParticipationMetrics("hostile", "Hostile", "rose"),
]);

const topStatCards = computed(() => [
  {
    label: "Matched wars",
    compact: String(battleMetrics.value.total),
    full: `${battleMetrics.value.total} tracked`,
    tone: "slate",
    help: "All wars from 05.06.2026 until today in the local database.",
  },
  {
    label: "Coalition tracked damage",
    compact: formatCompactNumber(sideDamage.value.coalition),
    full: formatNumber(sideDamage.value.coalition),
    tone: "emerald",
    help: "Damage by players from Passifists, APP and URL countries in matched wars.",
  },
  {
    label: "Hostile tracked damage",
    compact: formatCompactNumber(sideDamage.value.hostile),
    full: formatNumber(sideDamage.value.hostile),
    tone: "rose",
    help: "Damage by players from Bakers and affiliate countries in matched wars.",
  },
  {
    label: "Tracked players",
    compact: String(playerInsights.value.players.length),
    full: `${playerInsights.value.players.length} unique players`,
    tone: "slate",
    help: "Unique players from the listed campaign countries in matched wars.",
  },
]);

const recentFronts = computed(() =>
  campaignBattles.value.slice(0, 12).map((battle) => ({
    ...battle,
    attacker: getCampaignCountry(battle.attacker_name),
    defender: getCampaignCountry(battle.defender_name),
  })),
);

const dailyTimeline = computed(() => {
  const start = new Date(`${PASSIFISTS_VS_BAKERS_START_DATE}T00:00:00`);
  const end = new Date(`${today.value}T00:00:00`);
  const dayMap = new Map();

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    dayMap.set(key, {
      dateKey: key,
      dateLabel: cursor.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" }),
      battles: 0,
      coalitionWins: 0,
      hostileWins: 0,
      coalitionRounds: 0,
      hostileRounds: 0,
    });
  }

  campaignBattles.value.forEach((battle) => {
    const key = new Date(battle.end_date).toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (!bucket) {
      return;
    }

    bucket.battles += 1;

    const coalitionOnAttack = getCampaignSide(battle.attacker_name) === "coalition";
    const coalitionScore = coalitionOnAttack ? Number(battle.attackers_score) || 0 : Number(battle.defenders_score) || 0;
    const hostileScore = coalitionOnAttack ? Number(battle.defenders_score) || 0 : Number(battle.attackers_score) || 0;

    bucket.coalitionRounds += coalitionScore;
    bucket.hostileRounds += hostileScore;

    if (coalitionScore > hostileScore) {
      bucket.coalitionWins += 1;
    } else if (hostileScore > coalitionScore) {
      bucket.hostileWins += 1;
    }
  });

  const days = Array.from(dayMap.values());
  const maxBattles = Math.max(1, ...days.map((day) => day.battles));
  const maxRounds = Math.max(1, ...days.map((day) => Math.max(day.coalitionRounds, day.hostileRounds)));
  const width = 920;
  const height = 280;
  const paddingX = 26;
  const top = 22;
  const bottom = 34;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - top - bottom;

  const battlePoints = days.map((day, index) => {
    const x = paddingX + (days.length === 1 ? innerWidth / 2 : (index / (days.length - 1)) * innerWidth);
    const y = top + innerHeight - (day.battles / maxBattles) * innerHeight;
    return { x, y, day };
  });

  const coalitionLine = days
    .map((day, index) => {
      const x = paddingX + (days.length === 1 ? innerWidth / 2 : (index / (days.length - 1)) * innerWidth);
      const y = top + innerHeight - (day.coalitionRounds / maxRounds) * innerHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const hostileLine = days
    .map((day, index) => {
      const x = paddingX + (days.length === 1 ? innerWidth / 2 : (index / (days.length - 1)) * innerWidth);
      const y = top + innerHeight - (day.hostileRounds / maxRounds) * innerHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const battleArea = battlePoints.length
    ? `M ${battlePoints[0].x} ${top + innerHeight} ${battlePoints
        .map((point) => `L ${point.x} ${point.y}`)
        .join(" ")} L ${battlePoints[battlePoints.length - 1].x} ${top + innerHeight} Z`
    : "";

  return {
    days,
    maxBattles,
    maxRounds,
    width,
    height,
    top,
    innerHeight,
    battlePoints,
    coalitionLine,
    hostileLine,
    battleArea,
    totalBattleDays: days.filter((day) => day.battles > 0).length,
    hottestDay: [...days].sort((a, b) => b.battles - a.battles)[0] || null,
  };
});

const selectedCountryStats = computed(() => buildCountryStats(selectedCountry.value, campaignSummary.value, normalizeCountryKey));

function openCountryDetails(country) {
  selectedCountry.value = {
    country_name: country.name,
    country_avatar: country.country_avatar || null,
    display_name: country.name,
  };
  countryDetailsOpen.value = true;
}

function closeCountryDetails() {
  countryDetailsOpen.value = false;
}

function emitPlayerDetails(player) {
  emit("open-player-details", {
    player,
    battleIds: campaignBattleIds.value,
  });
}
</script>

<template>
  <section class="relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950/70 shadow-[0_40px_120px_rgba(2,6,23,0.45)]">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))]"></div>
    <div class="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:28px_28px]"></div>

    <div class="relative p-6 md:p-8 lg:p-10 space-y-8">
      <div class="flex flex-col gap-5">
        <div class="max-w-3xl">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100 transition-colors hover:border-emerald-300/60 hover:bg-emerald-500/15 hover:text-white"
            @click="emit('back')"
          >
            <span>&larr;</span>
            Exit dashboard
          </button>

          <div class="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.28em] text-emerald-200">
            Campaign Intelligence Dashboard
          </div>
          <h2 class="mt-4 text-4xl md:text-5xl font-black tracking-tight text-white [text-wrap:balance]">
            Passifists <span class="text-emerald-300">vs</span> The Bakers
          </h2>
          <p class="mt-4 max-w-2xl text-sm md:text-base leading-7 text-slate-300">
            A dedicated war room for the long campaign that started on
            <span class="font-semibold text-white">{{ formatShortDate(PASSIFISTS_VS_BAKERS_START_DATE) }}</span>
            and runs through
            <span class="font-semibold text-white">{{ formatShortDate(today) }}</span>
            while the conflict is active. The view combines alliance politics, battle fronts, and player output into one operational picture.
          </p>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="card in topStatCards"
            :key="card.label"
            class="rounded-2xl px-4 py-4"
            :class="{
              'border border-slate-800 bg-slate-900/70': card.tone === 'slate',
              'border border-emerald-500/20 bg-emerald-500/10': card.tone === 'emerald',
              'border border-rose-500/20 bg-rose-500/10': card.tone === 'rose',
            }"
          >
            <div
              class="text-[11px] uppercase tracking-[0.18em]"
              :class="{
                'text-slate-500': card.tone === 'slate',
                'text-emerald-200/70': card.tone === 'emerald',
                'text-rose-200/70': card.tone === 'rose',
              }"
            >
              {{ card.label }}
            </div>
            <div
              class="mt-2 text-3xl font-black leading-none"
              :class="{
                'text-white': card.tone === 'slate',
                'text-emerald-200': card.tone === 'emerald',
                'text-rose-200': card.tone === 'rose',
              }"
            >
              {{ card.compact }}
            </div>
            <div class="mt-2 text-xs font-mono text-slate-400">{{ card.full }}</div>
            <p class="mt-2 text-xs leading-5 text-slate-500">{{ card.help }}</p>
          </div>
        </div>
      </div>

      <div
        v-if="props.loadingBattles || loadingSummary"
        class="rounded-[24px] border border-slate-800 bg-slate-900/60 px-6 py-10 text-center text-slate-400"
      >
        Building the campaign board...
      </div>

      <div v-else-if="summaryError" class="rounded-[24px] border border-rose-500/20 bg-rose-500/10 px-6 py-8 text-rose-200">
        {{ summaryError }}
      </div>

      <template v-else>
        <div class="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5 md:p-6">
            <div class="flex items-end justify-between gap-4">
              <div>
                <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Operational pressure</p>
                <h3 class="mt-2 text-2xl font-bold text-white">Campaign balance</h3>
                <p class="mt-2 text-sm leading-6 text-slate-400">
                  This block shows war volume, win split and how the tracked damage is distributed between the two camps.
                </p>
              </div>
            </div>

            <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Coalition war wins</div>
                <div class="mt-3 text-3xl font-bold text-emerald-300">{{ battleMetrics.coalitionWins }}</div>
                <p class="mt-2 text-sm leading-6 text-slate-400">Wars where the coalition side finished with the higher score.</p>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Hostile war wins</div>
                <div class="mt-3 text-3xl font-bold text-rose-300">{{ battleMetrics.hostileWins }}</div>
                <p class="mt-2 text-sm leading-6 text-slate-400">Wars where Bakers or affiliates finished ahead on score.</p>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Coalition countries active</div>
                <div class="mt-3 text-3xl font-bold text-white">{{ battleMetrics.activeCoalitionCountries }}</div>
                <p class="mt-2 text-sm leading-6 text-slate-400">Listed coalition countries that actually appeared in matched wars.</p>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Hostile countries active</div>
                <div class="mt-3 text-3xl font-bold text-white">{{ battleMetrics.activeHostileCountries }}</div>
                <p class="mt-2 text-sm leading-6 text-slate-400">Listed Bakers or affiliate countries seen on the battlefield.</p>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Top 20 share</div>
                <div class="mt-3 text-3xl font-bold text-white">{{ formatPercent(playerInsights.top20Share) }}</div>
                <p class="mt-2 text-sm leading-6 text-slate-400">How much of all tracked campaign damage came from the top twenty players.</p>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">1%+ contributors</div>
                <div class="mt-3 text-3xl font-bold text-emerald-300">{{ playerInsights.impactfulPlayers }}</div>
                <p class="mt-2 text-sm leading-6 text-slate-400">Players who each delivered at least one percent of all tracked damage.</p>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">0.5%+ core contributors</div>
                <div class="mt-3 text-3xl font-bold text-amber-300">
                  {{ sideParticipation[0].coreContributors + sideParticipation[1].coreContributors }}
                </div>
                <p class="mt-2 text-sm leading-6 text-slate-400">Players who contributed at least 0.5% of their own side's tracked damage.</p>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Top 1 share</div>
                <div class="mt-3 text-3xl font-bold text-cyan-300">{{ formatPercent(playerInsights.top1Share) }}</div>
                <p class="mt-2 text-sm leading-6 text-slate-400">Single-player concentration of all tracked campaign damage.</p>
              </div>
            </div>

            <div class="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tracked damage share by bloc</div>
                  <p class="mt-2 text-sm leading-6 text-slate-400">
                    This compares total player damage from countries assigned to each side in this dashboard.
                  </p>
                </div>
                <div class="text-right text-sm">
                  <div class="text-emerald-200">
                    Coalition: {{ formatPercent(battleMetrics.coalitionDamageShare) }}
                    <span class="text-slate-500">({{ formatCompactNumber(sideDamage.coalition) }})</span>
                  </div>
                  <div class="text-rose-200">
                    Hostile: {{ formatPercent(battleMetrics.hostileDamageShare) }}
                    <span class="text-slate-500">({{ formatCompactNumber(sideDamage.hostile) }})</span>
                  </div>
                </div>
              </div>

              <div class="mt-4 h-4 overflow-hidden rounded-full border border-slate-800 bg-slate-950/80">
                <div
                  class="h-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-500"
                  :style="{ width: `${battleMetrics.coalitionDamageShare}%` }"
                ></div>
              </div>
              <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Passifists / APP / URL tracked player damage</span>
                <span>Bakers / affiliates tracked player damage</span>
              </div>
            </div>
          </div>

          <div class="grid gap-4">
            <div
              v-for="card in allianceCountryCards"
              :key="card.title"
              class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="text-lg font-bold text-white">{{ card.title }}</h3>
                  <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ card.subtitle }}</p>
                </div>
                <div
                  class="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
                  :class="
                    card.accent === 'emerald'
                      ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-200 border border-rose-500/20'
                  "
                >
                  {{ card.countries.length }} countries
                </div>
              </div>

              <div class="mt-4 flex flex-wrap gap-2">
                <div
                  v-for="country in card.countries"
                  :key="country.name"
                  class="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
                >
                  <div class="text-sm font-semibold text-slate-100">{{ country.flag }} {{ country.name }}</div>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <span
                      v-for="tag in country.tags"
                      :key="tag"
                      class="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]"
                      :class="{
                        'bg-emerald-500/10 text-emerald-200': tag === 'Passifists',
                        'bg-sky-500/10 text-sky-200': tag === 'APP',
                        'bg-violet-500/10 text-violet-200': tag === 'URL',
                        'bg-rose-500/10 text-rose-200': tag === 'Bakers',
                        'bg-amber-500/10 text-amber-200': tag === 'Affiliates',
                      }"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5 md:p-6">
            <div class="flex items-end justify-between gap-4">
              <div>
                <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Bloc comparison</p>
                <h3 class="mt-2 text-2xl font-bold text-white">Sub-alliance damage split</h3>
              </div>
            </div>

            <div class="mt-5 space-y-3">
              <div
                v-for="tagRow in tagPerformance"
                :key="tagRow.tag"
                class="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="text-sm font-semibold text-white">{{ tagRow.meta.label }}</div>
                    <div class="text-xs text-slate-500">{{ tagRow.meta.description }}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-lg font-bold text-slate-100">{{ formatNumber(tagRow.totalDamage) }}</div>
                  </div>
                </div>
                <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    class="h-full rounded-full"
                    :class="{
                      'bg-emerald-400': tagRow.tag === 'Passifists',
                      'bg-sky-400': tagRow.tag === 'APP',
                      'bg-violet-400': tagRow.tag === 'URL',
                      'bg-rose-400': tagRow.tag === 'Bakers',
                      'bg-amber-400': tagRow.tag === 'Affiliates',
                    }"
                    :style="{ width: `${playerInsights.totalDamage ? (tagRow.totalDamage / playerInsights.totalDamage) * 100 : 0}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5 md:p-6">
            <div class="flex items-end justify-between gap-4">
              <div>
                <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Country leaderboard</p>
                <h3 class="mt-2 text-2xl font-bold text-white">Country totals in matched wars</h3>
                <p class="mt-2 text-sm leading-6 text-slate-400">
                  This table is aggregated per country. Use it when comparing against the main summary grouped by country.
                </p>
              </div>
            </div>

            <div class="mt-5 overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-slate-500 uppercase text-[11px] tracking-[0.16em]">
                  <tr>
                    <th class="px-2 py-3 text-left">#</th>
                    <th class="px-2 py-3 text-left">Country</th>
                    <th class="px-2 py-3 text-left">Bloc</th>
                    <th class="px-2 py-3 text-right">Damage</th>
                    <th class="px-2 py-3 text-right">Hits</th>
                    <th class="px-2 py-3 text-right">Players</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50">
                  <tr v-for="(country, index) in countryPerformance.slice(0, 14)" :key="country.name" class="hover:bg-slate-800/25">
                    <td class="px-2 py-3 text-slate-600 font-mono">{{ index + 1 }}</td>
                    <td class="px-2 py-3">
                      <button
                        type="button"
                        class="font-semibold text-white hover:text-emerald-200 transition-colors underline-offset-2 hover:underline"
                        @click="openCountryDetails(country)"
                      >
                        {{ country.flag }} {{ country.name }}
                      </button>
                    </td>
                    <td class="px-2 py-3">
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="tag in country.tags"
                          :key="tag"
                          class="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]"
                          :class="{
                            'bg-emerald-500/10 text-emerald-200': tag === 'Passifists',
                            'bg-sky-500/10 text-sky-200': tag === 'APP',
                            'bg-violet-500/10 text-violet-200': tag === 'URL',
                            'bg-rose-500/10 text-rose-200': tag === 'Bakers',
                            'bg-amber-500/10 text-amber-200': tag === 'Affiliates',
                          }"
                        >
                          {{ tag }}
                        </span>
                      </div>
                    </td>
                    <td class="px-2 py-3 text-right font-mono text-emerald-300">{{ formatNumber(country.total_damage) }}</td>
                    <td class="px-2 py-3 text-right font-mono text-slate-300">{{ formatNumber(country.hit_count) }}</td>
                    <td class="px-2 py-3 text-right font-mono text-slate-400">{{ country.player_count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5 md:p-6">
          <div class="flex items-end justify-between gap-4">
            <div>
              <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Roster pressure</p>
              <h3 class="mt-2 text-2xl font-bold text-white">Participation and real impact</h3>
              <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                This block separates raw attendance from actual carrying power. A meaningful contributor means at least
                <span class="font-semibold text-white"> 1% of that side&apos;s tracked damage</span>, while support means at least
                <span class="font-semibold text-white"> 0.1%</span>.
              </p>
            </div>
          </div>

          <div class="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="card in participationCards"
              :key="card.label"
              class="rounded-2xl border px-4 py-4"
              :class="{
                'border-slate-800 bg-slate-950/60': card.tone === 'slate',
                'border-cyan-500/20 bg-cyan-500/10': card.tone === 'cyan',
                'border-amber-500/20 bg-amber-500/10': card.tone === 'amber',
              }"
            >
              <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">{{ card.label }}</div>
              <div class="mt-2 text-2xl font-black text-white">{{ card.value }}</div>
              <p class="mt-2 text-xs leading-5 text-slate-400">{{ card.note }}</p>
            </div>
          </div>

          <div class="mt-6 grid gap-4 xl:grid-cols-2">
            <div
              v-for="side in sideParticipation"
              :key="side.sideKey"
              class="rounded-[24px] border p-5"
              :class="
                side.accent === 'emerald'
                  ? 'border-emerald-500/20 bg-emerald-500/8'
                  : 'border-rose-500/20 bg-rose-500/8'
              "
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div
                    class="text-[11px] uppercase tracking-[0.18em]"
                    :class="side.accent === 'emerald' ? 'text-emerald-200/70' : 'text-rose-200/70'"
                  >
                    {{ side.label }}
                  </div>
                  <h4 class="mt-2 text-2xl font-bold text-white">{{ side.totalPlayers }} players</h4>
                </div>
                <div class="text-right">
                  <div class="text-xs uppercase tracking-[0.16em] text-slate-500">Tracked damage</div>
                  <div class="mt-1 text-lg font-bold text-white">{{ formatCompactNumber(side.totalDamage) }}</div>
                </div>
              </div>

              <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div class="rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-3">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Meaningful</div>
                  <div class="mt-2 text-lg font-semibold text-white">{{ side.significantPlayers }}</div>
                  <p class="mt-1 text-xs text-slate-400">At least 1% of side damage.</p>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-3">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Support</div>
                  <div class="mt-2 text-lg font-semibold text-white">{{ side.supportPlayers }}</div>
                  <p class="mt-1 text-xs text-slate-400">At least 0.1% of side damage.</p>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-3">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Core contributors</div>
                  <div class="mt-2 text-lg font-semibold text-white">{{ side.coreContributors }}</div>
                  <p class="mt-1 text-xs text-slate-400">Each did at least 0.5% of side damage.</p>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-3">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">For 50% damage</div>
                  <div class="mt-2 text-lg font-semibold text-white">{{ side.playersFor50 }}</div>
                  <p class="mt-1 text-xs text-slate-400">Players needed to reach half the side output.</p>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-3">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Average per player</div>
                  <div class="mt-2 text-lg font-semibold text-white">{{ formatCompactNumber(side.avgDamage) }}</div>
                  <p class="mt-1 text-xs text-slate-400">Mean tracked damage across the whole roster.</p>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-3">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Trace players</div>
                  <div class="mt-2 text-lg font-semibold text-white">{{ side.tracePlayers }}</div>
                  <p class="mt-1 text-xs text-slate-400">Below 0.1% of side damage each.</p>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-3">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Low impact</div>
                  <div class="mt-2 text-lg font-semibold text-white">{{ side.lowImpactPlayers }}</div>
                  <p class="mt-1 text-xs text-slate-400">Below 1% of side damage each.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PassifistsVsBakersLeaderboards
          :players="playerInsights.players"
          :format-number="formatNumber"
          @open-player-details="emitPlayerDetails"
        />

        <PassifistsVsBakersTimeline :daily-timeline="dailyTimeline" />

        <PassifistsVsBakersFrontLog :recent-fronts="recentFronts" :format-short-date="formatShortDate" />

        <div class="flex justify-center">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-300/60 hover:bg-emerald-500/15 hover:text-white"
            @click="emit('back')"
          >
            <span>&larr;</span>
            Back to main page
          </button>
        </div>

        <CountryDetailsModal
          :is-open="countryDetailsOpen"
          :stats="selectedCountryStats"
          :format-number="formatNumber"
          @close="closeCountryDetails"
          @open-player-details="emitPlayerDetails($event)"
        />
      </template>
    </div>
  </section>
</template>
