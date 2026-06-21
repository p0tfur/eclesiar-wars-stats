<script setup>
import { computed } from "vue";

const emit = defineEmits(["open-player-details"]);

const props = defineProps({
  players: {
    type: Array,
    required: true,
  },
  formatNumber: {
    type: Function,
    required: true,
  },
});

const topDamagePlayers = computed(() => props.players.slice(0, 20));
const topBhPlayers = computed(() =>
  [...props.players]
    .sort((a, b) => {
      if (b.bh_count !== a.bh_count) {
        return b.bh_count - a.bh_count;
      }
      return b.total_damage - a.total_damage;
    })
    .slice(0, 10),
);

function handlePlayerClick(player) {
  emit("open-player-details", player);
}
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-2">
    <div class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5 md:p-6">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Players</p>
          <h3 class="mt-2 text-2xl font-bold text-white">Top individual players</h3>
          <p class="mt-2 text-sm leading-6 text-slate-400">
            This table is per player, not per country. Compare country totals in the leaderboard above.
          </p>
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
            <tr v-for="(player, index) in topDamagePlayers" :key="player.fighter_id" class="hover:bg-slate-800/25">
              <td class="px-2 py-3 text-slate-600 font-mono">{{ index + 1 }}</td>
              <td class="px-2 py-3">
                <button
                  type="button"
                  class="font-semibold text-white hover:text-emerald-200 transition-colors underline-offset-2 hover:underline"
                  @click="handlePlayerClick(player)"
                >
                  {{ player.display_name }}
                </button>
              </td>
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
              <td class="px-2 py-3 text-right font-mono text-emerald-300">{{ props.formatNumber(player.total_damage) }}</td>
              <td class="px-2 py-3 text-right font-mono text-slate-300">{{ props.formatNumber(player.hit_count) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="rounded-[26px] border border-amber-400/20 bg-slate-900/65 p-5 md:p-6">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">Battle Heroes</p>
          <h3 class="mt-2 text-2xl font-bold text-white">Top 10 BH</h3>
          <p class="mt-2 text-sm leading-6 text-slate-400">Players with the most battle hero appearances during this campaign.</p>
        </div>
      </div>

      <div class="mt-5 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-amber-200/70 uppercase text-[11px] tracking-[0.16em]">
            <tr>
              <th class="px-2 py-3 text-left">#</th>
              <th class="px-2 py-3 text-left">Player</th>
              <th class="px-2 py-3 text-left">Country</th>
              <th class="px-2 py-3 text-left">Tags</th>
              <th class="px-2 py-3 text-right">BH</th>
              <th class="px-2 py-3 text-right">Damage</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-amber-500/10">
            <tr v-for="(player, index) in topBhPlayers" :key="`bh-${player.fighter_id}`" class="hover:bg-amber-500/5">
              <td class="px-2 py-3 text-amber-200/70 font-mono">{{ index + 1 }}</td>
              <td class="px-2 py-3">
                <button
                  type="button"
                  class="font-semibold text-white hover:text-amber-200 transition-colors underline-offset-2 hover:underline"
                  @click="handlePlayerClick(player)"
                >
                  {{ player.display_name }}
                </button>
              </td>
              <td class="px-2 py-3 text-slate-300">{{ player.flag }} {{ player.country_name }}</td>
              <td class="px-2 py-3">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="tag in player.tags"
                    :key="`${player.fighter_id}-${tag}`"
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
              <td class="px-2 py-3 text-right font-mono text-amber-300">{{ props.formatNumber(player.bh_count) }}</td>
              <td class="px-2 py-3 text-right font-mono text-slate-300">{{ props.formatNumber(player.total_damage) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
