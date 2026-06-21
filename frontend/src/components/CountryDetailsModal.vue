<script setup>
import { computed } from "vue";

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  stats: {
    type: Object,
    default: null,
  },
  formatNumber: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["close", "open-player-details"]);

const countryName = computed(() => props.stats?.country?.country_name || props.stats?.country?.display_name || "Country");

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

const metricCards = computed(() => {
  if (!props.stats) {
    return [];
  }

  return [
    { label: "Participants", value: props.stats.playerCount, tone: "text-slate-100" },
    { label: "Avg damage", value: props.formatNumber(Math.round(props.stats.averageDamage)), tone: "text-emerald-300" },
    { label: "Median damage", value: props.formatNumber(Math.round(props.stats.medianDamage)), tone: "text-cyan-300" },
    { label: "Total hits", value: props.formatNumber(props.stats.totalHits), tone: "text-amber-300" },
  ];
});

const concentrationCards = computed(() => {
  if (!props.stats) {
    return [];
  }

  return [
    { label: "Top 1 share", value: formatPercent(props.stats.top1Share) },
    { label: "Top 3 share", value: formatPercent(props.stats.top3Share) },
    { label: "Top 5 share", value: formatPercent(props.stats.top5Share) },
    { label: "50% damage", value: `${props.stats.playersFor50} players` },
    { label: "75% damage", value: `${props.stats.playersFor75} players` },
    { label: "90% damage", value: `${props.stats.playersFor90} players` },
  ];
});

const effectivenessCards = computed(() => {
  if (!props.stats) {
    return [];
  }

  return [
    { label: "1%+ share", value: `${props.stats.playersAbove1Pct}/${props.stats.playerCount}` },
    { label: "0.5%+ share", value: `${props.stats.playersAbove05Pct}/${props.stats.playerCount}` },
    { label: "10%+ share", value: `${props.stats.playersAbove10Pct}/${props.stats.playerCount}` },
    { label: "Attackers", value: props.stats.sideCounts.attackers },
    { label: "Defenders", value: props.stats.sideCounts.defenders },
    { label: "Mixed/other", value: props.stats.sideCounts.mixed },
  ];
});

const tailCards = computed(() => {
  if (!props.stats) {
    return [];
  }

  return [
    { label: "< 0.1% share", value: `${props.stats.tracePlayers}/${props.stats.playerCount}`, tone: "text-rose-300" },
    { label: "< 0.5% share", value: `${props.stats.marginalPlayers}/${props.stats.playerCount}`, tone: "text-amber-300" },
    { label: "< 1% share", value: `${props.stats.lowImpactPlayers}/${props.stats.playerCount}`, tone: "text-yellow-200" },
    { label: "< 0.1% share", value: `${props.stats.tracePlayers}/${props.stats.playerCount}`, tone: "text-rose-300" },
    { label: "Bottom 50% dmg", value: formatPercent(props.stats.bottomHalfShare), tone: "text-cyan-300" },
    { label: "Outside top 10", value: formatPercent(props.stats.tailShareOutsideTop10), tone: "text-emerald-300" },
  ];
});

const performanceBadgeClass = computed(() => {
  if (!props.stats) {
    return "bg-slate-500/10 text-slate-200 border-slate-500/20";
  }

  if (props.stats.performanceTone === "rose") {
    return "bg-rose-500/10 text-rose-200 border-rose-500/20";
  }

  if (props.stats.performanceTone === "amber") {
    return "bg-amber-500/10 text-amber-200 border-amber-500/20";
  }

  if (props.stats.performanceTone === "cyan") {
    return "bg-cyan-500/10 text-cyan-200 border-cyan-500/20";
  }

  return "bg-emerald-500/10 text-emerald-200 border-emerald-500/20";
});
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/65 backdrop-blur-sm" @click="emit('close')"></div>
      <div
        class="relative w-full max-w-6xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div class="flex items-center gap-3 min-w-0">
            <div
              v-if="stats?.country?.country_avatar"
              class="w-12 h-12 rounded-full overflow-hidden border border-slate-700 bg-slate-800 shrink-0"
            >
              <img :src="stats.country.country_avatar" :alt="countryName" class="w-full h-full object-cover" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-white">Country efficiency</h3>
              <p class="text-sm text-slate-400">{{ countryName }}</p>
              <div
                v-if="stats?.performanceLabel"
                class="mt-2 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                :class="performanceBadgeClass"
              >
                {{ stats.performanceLabel }}
              </div>
            </div>
          </div>
          <button type="button" class="text-slate-400 hover:text-white transition-colors" @click="emit('close')">
            X
          </button>
        </div>

        <div class="px-6 py-5 space-y-5 overflow-y-auto min-h-0">
          <div v-if="!stats" class="text-center py-10 text-slate-500">No country data available.</div>

          <template v-else>
            <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <h4 class="text-sm font-semibold text-white">Roster profile</h4>
              <p class="mt-2 text-sm leading-6 text-slate-400">{{ stats.performanceDescription }}</p>
            </div>

            <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div
                v-for="card in metricCards"
                :key="card.label"
                class="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
              >
                <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">{{ card.label }}</div>
                <div class="mt-2 text-lg font-semibold" :class="card.tone">{{ card.value }}</div>
              </div>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 class="text-sm font-semibold text-white">Damage concentration</h4>
                <p class="mt-1 text-xs text-slate-500">How many players are needed to carry the result.</p>
                <div class="mt-4 grid grid-cols-2 gap-3">
                  <div
                    v-for="card in concentrationCards"
                    :key="card.label"
                    class="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3"
                  >
                    <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">{{ card.label }}</div>
                    <div class="mt-2 text-base font-semibold text-emerald-300">{{ card.value }}</div>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 class="text-sm font-semibold text-white">Effective participation</h4>
                <p class="mt-1 text-xs text-slate-500">Shows how deep the roster really contributed.</p>
                <div class="mt-4 grid grid-cols-2 gap-3">
                  <div
                    v-for="card in effectivenessCards"
                    :key="card.label"
                    class="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3"
                  >
                    <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">{{ card.label }}</div>
                    <div class="mt-2 text-base font-semibold text-cyan-300">{{ card.value }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <h4 class="text-sm font-semibold text-white">Long tail / low impact</h4>
              <p class="mt-1 text-xs text-slate-500">
                Quick view of how many people showed up but contributed only trace damage.
              </p>
              <div class="mt-4 grid grid-cols-2 xl:grid-cols-3 gap-3">
                <div
                  v-for="card in tailCards"
                  :key="card.label"
                  class="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3"
                >
                  <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">{{ card.label }}</div>
                  <div class="mt-2 text-base font-semibold" :class="card.tone">{{ card.value }}</div>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 class="text-sm font-semibold text-white">Top contributors</h4>
                  <p class="text-xs text-slate-500">Click a player to open their battle-by-battle breakdown.</p>
                </div>
                <div class="text-xs text-slate-500 font-mono">
                  {{ stats.playerCount }} players | {{ formatNumber(stats.totalDamage) }} total damage
                </div>
              </div>

              <div class="mt-4 overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-slate-950/50 text-slate-400 font-medium uppercase text-xs tracking-wider">
                    <tr>
                      <th class="px-2 py-3 text-left w-12">#</th>
                      <th class="px-3 py-3 text-left">Player</th>
                      <th class="px-3 py-3 text-left">Side</th>
                      <th class="px-3 py-3 text-right">Damage</th>
                      <th class="px-3 py-3 text-right">Damage share</th>
                      <th class="px-3 py-3 text-right">Cumulative</th>
                      <th class="px-3 py-3 text-right">Hits</th>
                      <th class="px-3 py-3 text-right">Hits share</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/50">
                    <tr v-for="(player, index) in stats.players" :key="player.fighter_id" class="hover:bg-slate-800/30">
                      <td class="px-2 py-2 font-mono text-slate-600 text-xs">{{ index + 1 }}</td>
                      <td class="px-3 py-2">
                        <button
                          type="button"
                          class="flex items-center gap-2 text-left group"
                          @click="emit('open-player-details', player)"
                        >
                          <img
                            v-if="player.player_avatar"
                            :src="player.player_avatar"
                            :alt="player.display_name"
                            class="w-8 h-8 rounded-full border border-slate-700 group-hover:border-emerald-500/50 transition-colors object-cover"
                          />
                          <div
                            v-else
                            class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700 group-hover:border-emerald-500/50"
                          >
                            {{ player.display_name.charAt(0).toUpperCase() }}
                          </div>
                          <span class="text-slate-200 group-hover:text-white transition-colors underline-offset-2 group-hover:underline">
                            {{ player.display_name }}
                          </span>
                        </button>
                      </td>
                      <td class="px-3 py-2 text-slate-400">{{ player.side || "UNKNOWN" }}</td>
                      <td class="px-3 py-2 text-right font-mono text-emerald-300">
                        {{ formatNumber(player.total_damage) }}
                      </td>
                      <td class="px-3 py-2 text-right font-mono text-cyan-300">{{ formatPercent(player.damageShare) }}</td>
                      <td class="px-3 py-2 text-right font-mono text-amber-300">{{ formatPercent(player.cumulativeDamage) }}</td>
                      <td class="px-3 py-2 text-right font-mono text-slate-300">{{ formatNumber(player.hit_count) }}</td>
                      <td class="px-3 py-2 text-right font-mono text-slate-400">{{ formatPercent(player.hitsShare) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>

        <div class="px-6 py-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            class="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 hover:border-emerald-500/30 transition-colors"
            @click="emit('close')"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
