<script setup>
import { computed, ref, watch } from "vue";
import { getWarSummary } from "../api.js";
import {
  ALLIANCE_TAG_META,
  COALITION_COUNTRIES,
  HOSTILE_COUNTRIES,
  PASSIFISTS_VS_BAKERS_START_DATE,
  getCampaignCountry,
  getCampaignSide,
} from "../constants/passifistsVsBakers.js";

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

const emit = defineEmits(["back"]);

const loadingSummary = ref(false);
const summaryError = ref("");
const campaignSummary = ref([]);

function formatNumber(num) {
  return (Number(num) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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
      if (battleDate < start || battleDate > end) {
        return false;
      }

      const attackerSide = getCampaignSide(battle.attacker_name);
      const defenderSide = getCampaignSide(battle.defender_name);

      return (
        (attackerSide === "coalition" && defenderSide === "hostile") ||
        (attackerSide === "hostile" && defenderSide === "coalition")
      );
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

const battleMetrics = computed(() => {
  const coalitionWins = campaignBattles.value.filter((battle) => {
    const coalitionOnAttack = getCampaignSide(battle.attacker_name) === "coalition";
    const coalitionScore = coalitionOnAttack ? Number(battle.attackers_score) || 0 : Number(battle.defenders_score) || 0;
    const hostileScore = coalitionOnAttack ? Number(battle.defenders_score) || 0 : Number(battle.attackers_score) || 0;
    return coalitionScore > hostileScore;
  }).length;

  return {
    total: campaignBattles.value.length,
    coalitionWins,
    hostileWins: campaignBattles.value.length - coalitionWins,
    activeCoalitionCountries: new Set(campaignBattles.value.map((battle) => battle.attacker_name).filter((name) => getCampaignSide(name) === "coalition")).size +
      new Set(campaignBattles.value.map((battle) => battle.defender_name).filter((name) => getCampaignSide(name) === "coalition")).size,
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

const sideDamage = computed(() => {
  return countryPerformance.value.reduce(
    (acc, country) => {
      if (country.side === "coalition") {
        acc.coalition += country.total_damage;
      } else if (country.side === "hostile") {
        acc.hostile += country.total_damage;
      }
      return acc;
    },
    { coalition: 0, hostile: 0 },
  );
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
  };
});

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
</script>

<template>
  <section class="relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950/70 shadow-[0_40px_120px_rgba(2,6,23,0.45)]">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))]"></div>
    <div class="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:28px_28px]"></div>

    <div class="relative p-6 md:p-8 lg:p-10 space-y-8">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div class="max-w-3xl">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300 transition-colors hover:border-emerald-400/40 hover:text-white"
            @click="emit('back')"
          >
            <span>←</span>
            Back to command center
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

        <div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:w-[520px]">
          <div class="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Matched wars</div>
            <div class="mt-2 text-2xl font-bold text-white">{{ battleMetrics.total }}</div>
          </div>
          <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
            <div class="text-[11px] uppercase tracking-[0.18em] text-emerald-200/70">Coalition damage</div>
            <div class="mt-2 text-2xl font-bold text-emerald-200">{{ formatNumber(sideDamage.coalition) }}</div>
          </div>
          <div class="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4">
            <div class="text-[11px] uppercase tracking-[0.18em] text-rose-200/70">Hostile damage</div>
            <div class="mt-2 text-2xl font-bold text-rose-200">{{ formatNumber(sideDamage.hostile) }}</div>
          </div>
          <div class="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tracked players</div>
            <div class="mt-2 text-2xl font-bold text-white">{{ playerInsights.players.length }}</div>
          </div>
        </div>
      </div>

      <div v-if="props.loadingBattles || loadingSummary" class="rounded-[24px] border border-slate-800 bg-slate-900/60 px-6 py-10 text-center text-slate-400">
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
              </div>
              <div class="text-right text-xs text-slate-500">
                Coalition wins: <span class="text-emerald-300">{{ battleMetrics.coalitionWins }}</span><br />
                Hostile wins: <span class="text-rose-300">{{ battleMetrics.hostileWins }}</span>
              </div>
            </div>

            <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Top 20 share</div>
                <div class="mt-3 text-3xl font-bold text-white">{{ playerInsights.top20Share.toFixed(1) }}%</div>
                <p class="mt-2 text-sm leading-6 text-slate-400">How much of the whole war was carried by the top twenty players.</p>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">1%+ contributors</div>
                <div class="mt-3 text-3xl font-bold text-emerald-300">{{ playerInsights.impactfulPlayers }}</div>
                <p class="mt-2 text-sm leading-6 text-slate-400">Players who each delivered at least one percent of all tracked campaign damage.</p>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">5%+ heavy lifters</div>
                <div class="mt-3 text-3xl font-bold text-amber-300">{{ playerInsights.heavyLifters }}</div>
                <p class="mt-2 text-sm leading-6 text-slate-400">Quick read on whether the campaign is broad-based or carried by very few monsters.</p>
              </div>
            </div>

            <div class="mt-6 h-4 overflow-hidden rounded-full border border-slate-800 bg-slate-950/80">
              <div
                class="h-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-500"
                :style="{ width: `${sideDamage.coalition + sideDamage.hostile ? (sideDamage.coalition / (sideDamage.coalition + sideDamage.hostile)) * 100 : 0}%` }"
              ></div>
            </div>
            <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Coalition output</span>
              <span>Hostile output</span>
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
                  :class="card.accent === 'emerald' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-200 border border-rose-500/20'"
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
                  <p v-if="country.note" class="mt-2 text-xs leading-5 text-slate-500">{{ country.note }}</p>
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
                <h3 class="mt-2 text-2xl font-bold text-white">Who actually carried this war?</h3>
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
                    <td class="px-2 py-3 text-white font-semibold">{{ country.flag }} {{ country.name }}</td>
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

        <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5 md:p-6 xl:col-span-2">
            <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Timeline</p>
                <h3 class="mt-2 text-2xl font-bold text-white">Day-by-day campaign pressure</h3>
                <p class="mt-2 text-sm leading-6 text-slate-400">
                  Area shows how many matched wars fired each day. Green and red lines track total round score taken that day by each bloc.
                </p>
              </div>
              <div class="grid grid-cols-2 gap-3 text-sm md:min-w-[320px]">
                <div class="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Active days</div>
                  <div class="mt-2 text-xl font-bold text-white">{{ dailyTimeline.totalBattleDays }}</div>
                </div>
                <div class="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Peak day</div>
                  <div class="mt-2 text-xl font-bold text-white">
                    {{ dailyTimeline.hottestDay?.dateLabel || "-" }}
                  </div>
                  <div class="text-xs text-slate-500">
                    {{ dailyTimeline.hottestDay?.battles || 0 }} battles
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-6 overflow-x-auto">
              <svg
                :viewBox="`0 0 ${dailyTimeline.width} ${dailyTimeline.height}`"
                class="min-w-[920px] w-full h-[320px]"
                role="img"
                aria-label="Campaign timeline"
              >
                <defs>
                  <linearGradient id="campaignBattleArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="rgba(148,163,184,0.35)" />
                    <stop offset="100%" stop-color="rgba(148,163,184,0.04)" />
                  </linearGradient>
                </defs>

                <g v-for="step in 4" :key="step">
                  <line
                    :x1="26"
                    :x2="dailyTimeline.width - 26"
                    :y1="dailyTimeline.top + (dailyTimeline.innerHeight / 4) * step"
                    :y2="dailyTimeline.top + (dailyTimeline.innerHeight / 4) * step"
                    stroke="rgba(148,163,184,0.14)"
                    stroke-dasharray="4 6"
                  />
                </g>

                <path :d="dailyTimeline.battleArea" fill="url(#campaignBattleArea)" />
                <path :d="dailyTimeline.coalitionLine" fill="none" stroke="#34d399" stroke-width="4" stroke-linecap="round" />
                <path :d="dailyTimeline.hostileLine" fill="none" stroke="#fb7185" stroke-width="4" stroke-linecap="round" />

                <g v-for="point in dailyTimeline.battlePoints" :key="point.day.dateKey">
                  <circle :cx="point.x" :cy="point.y" r="4" fill="#e2e8f0" fill-opacity="0.85" />
                  <title>
                    {{ point.day.dateKey }} | battles: {{ point.day.battles }} | coalition rounds:
                    {{ point.day.coalitionRounds }} | hostile rounds: {{ point.day.hostileRounds }}
                  </title>
                </g>

                <g
                  v-for="(day, index) in dailyTimeline.days.filter((_, index) => index % Math.max(1, Math.ceil(dailyTimeline.days.length / 8)) === 0)"
                  :key="day.dateKey"
                >
                  <text
                    :x="26 + (dailyTimeline.days.length === 1 ? (dailyTimeline.width - 52) / 2 : ((index * Math.max(1, Math.ceil(dailyTimeline.days.length / 8))) / (dailyTimeline.days.length - 1)) * (dailyTimeline.width - 52))"
                    :y="dailyTimeline.height - 10"
                    fill="#64748b"
                    font-size="11"
                    text-anchor="middle"
                  >
                    {{ day.dateLabel }}
                  </text>
                </g>
              </svg>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span class="inline-flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-slate-300"></span> matched wars per day</span>
              <span class="inline-flex items-center gap-2"><span class="h-2.5 w-6 rounded-full bg-emerald-400"></span> coalition round score</span>
              <span class="inline-flex items-center gap-2"><span class="h-2.5 w-6 rounded-full bg-rose-400"></span> hostile round score</span>
            </div>
          </div>

          <div class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5 md:p-6">
            <div class="flex items-end justify-between gap-4">
              <div>
                <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Players</p>
                <h3 class="mt-2 text-2xl font-bold text-white">Campaign top 20</h3>
              </div>
            </div>

            <div class="mt-5 overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-slate-500 uppercase text-[11px] tracking-[0.16em]">
                  <tr>
                    <th class="px-2 py-3 text-left">#</th>
                    <th class="px-2 py-3 text-left">Player</th>
                    <th class="px-2 py-3 text-left">Country</th>
                    <th class="px-2 py-3 text-left">Tags</th>
                    <th class="px-2 py-3 text-right">Damage</th>
                    <th class="px-2 py-3 text-right">Hits</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50">
                  <tr v-for="(player, index) in playerInsights.players.slice(0, 20)" :key="player.fighter_id" class="hover:bg-slate-800/25">
                    <td class="px-2 py-3 text-slate-600 font-mono">{{ index + 1 }}</td>
                    <td class="px-2 py-3 text-white font-semibold">{{ player.display_name }}</td>
                    <td class="px-2 py-3 text-slate-300">{{ player.flag }} {{ player.country_name }}</td>
                    <td class="px-2 py-3">
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="tag in player.tags"
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
                    <td class="px-2 py-3 text-right font-mono text-emerald-300">{{ formatNumber(player.total_damage) }}</td>
                    <td class="px-2 py-3 text-right font-mono text-slate-300">{{ formatNumber(player.hit_count) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5 md:p-6">
            <div class="flex items-end justify-between gap-4">
              <div>
                <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Front log</p>
                <h3 class="mt-2 text-2xl font-bold text-white">Recent war fronts</h3>
              </div>
            </div>

            <div class="mt-5 space-y-3">
              <div
                v-for="battle in recentFronts"
                :key="battle.id"
                class="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="text-sm font-semibold text-white">#{{ battle.id }}</div>
                  <div class="text-xs uppercase tracking-[0.16em] text-slate-500">{{ formatShortDate(battle.end_date) }}</div>
                </div>
                <div class="mt-3 flex items-center justify-between gap-3 text-sm">
                  <div class="min-w-0">
                    <div class="font-semibold text-emerald-200">
                      {{ battle.attacker?.flag || "•" }} {{ battle.attacker_name }}
                    </div>
                    <div class="text-xs text-slate-500">Attacker</div>
                  </div>
                  <div class="text-lg font-black text-slate-500">{{ battle.attackers_score }} : {{ battle.defenders_score }}</div>
                  <div class="min-w-0 text-right">
                    <div class="font-semibold text-rose-200">
                      {{ battle.defender?.flag || "•" }} {{ battle.defender_name }}
                    </div>
                    <div class="text-xs text-slate-500">Defender</div>
                  </div>
                </div>
                <div class="mt-3 text-xs text-slate-500">{{ battle.region_name || "Unknown region" }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
