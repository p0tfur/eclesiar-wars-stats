<script setup>
const props = defineProps({
  loading: {
    type: Boolean,
    required: true,
  },
  sortedDisplayedBattles: {
    type: Array,
    required: true,
  },
  battlesCount: {
    type: Number,
    required: true,
  },
  displayedBattlesCount: {
    type: Number,
    required: true,
  },
  countryFiltersCount: {
    type: Number,
    required: true,
  },
  excludeCountryFiltersCount: {
    type: Number,
    required: true,
  },
  selectedBattleCount: {
    type: Number,
    required: true,
  },
  hasSelectedBattles: {
    type: Boolean,
    required: true,
  },
  combinedBattleCount: {
    type: Number,
    required: true,
  },
  loadingSummary: {
    type: Boolean,
    required: true,
  },
  refreshingBattleId: {
    type: [Number, null],
    default: null,
  },
  isBattleIncomplete: {
    type: Function,
    required: true,
  },
  isBattleSelected: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["toggle-all-battles", "generate-summary", "toggle-battle", "refresh-battle"]);
</script>

<template>
  <!-- Battles table -->
  <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-sm">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold text-white flex items-center gap-2">
        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          ></path>
        </svg>
        Battles
      </h2>
      <div class="flex gap-2">
        <button
          class="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
          @click="emit('toggle-all-battles')"
        >
          {{ selectedBattleCount === battlesCount ? "Deselect All" : "Select All" }}
        </button>
        <button
          :disabled="!hasSelectedBattles || loadingSummary"
          class="px-4 py-1.5 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
          @click="emit('generate-summary')"
        >
          <span v-if="loadingSummary">Loading...</span>
          <span v-else>Generate Summary ({{ combinedBattleCount }})</span>
        </button>
      </div>
    </div>

    <div v-if="countryFiltersCount || excludeCountryFiltersCount" class="mb-4 text-sm text-slate-400">
      Showing {{ displayedBattlesCount }} of {{ battlesCount }} battles (filtered)
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-12 text-slate-500">
      <svg class="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      Loading battles...
    </div>

    <!-- Empty state -->
    <div v-else-if="battlesCount === 0" class="text-center py-12 text-slate-500">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        ></path>
      </svg>
      <p>No battles found. Fetch a battle using the ID above.</p>
    </div>

    <!-- Battles list -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-950/50 text-slate-400 font-medium uppercase text-xs tracking-wider">
          <tr>
            <th class="px-1 py-3 text-center w-8" title="Select">☑</th>
            <th class="px-2 py-3 text-left">ID</th>
            <th class="px-2 py-3 text-left">Attacker</th>
            <th class="px-2 py-3 text-left">Defender</th>
            <th class="px-2 py-3 text-left">Region</th>
            <th class="px-2 py-3 text-left">Date</th>
            <th class="px-2 py-3 text-center">Score</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/50">
          <tr
            v-for="battle in sortedDisplayedBattles"
            :key="battle.id"
            class="hover:bg-slate-800/30 transition-colors group"
            :class="{ 'bg-amber-500/5': isBattleIncomplete(battle) }"
          >
            <td class="px-0 py-2 w-6 text-center">
              <input
                type="checkbox"
                :checked="isBattleSelected(battle.id)"
                class="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0"
                @change="emit('toggle-battle', battle.id, $event.target.checked)"
              />
            </td>
            <td class="px-2 py-2">
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-slate-500">{{ battle.id }}</span>
                <!-- Refresh button for incomplete battles -->
                <button
                  v-if="isBattleIncomplete(battle)"
                  :disabled="refreshingBattleId !== null"
                  class="p-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  :title="`Refresh (score: ${battle.attackers_score}:${battle.defenders_score})`"
                  @click.stop="emit('refresh-battle', battle.id)"
                >
                  <svg
                    v-if="refreshingBattleId === battle.id"
                    class="w-3 h-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    ></path>
                  </svg>
                </button>
              </div>
            </td>
            <td class="px-2 py-2">
              <div class="flex items-center gap-1.5">
                <img
                  v-if="battle.attacker_avatar"
                  :src="battle.attacker_avatar"
                  class="w-5 h-5 rounded border border-slate-700"
                  :alt="battle.attacker_name"
                />
                <span class="text-slate-200 group-hover:text-white transition-colors text-xs">{{
                  battle.attacker_name
                }}</span>
              </div>
            </td>
            <td class="px-2 py-2">
              <div class="flex items-center gap-1.5">
                <img
                  v-if="battle.defender_avatar"
                  :src="battle.defender_avatar"
                  class="w-5 h-5 rounded border border-slate-700"
                  :alt="battle.defender_name"
                />
                <span class="text-slate-200 group-hover:text-white transition-colors text-xs">{{
                  battle.defender_name
                }}</span>
              </div>
            </td>
            <td class="px-2 py-2">
              <div class="text-slate-300 text-xs">{{ battle.region_name || "Unknown" }}</div>
            </td>
            <td class="px-2 py-2 text-slate-400 text-xs font-mono">
              {{ battle.end_date ? new Date(battle.end_date).toLocaleDateString("pl-PL") : "-" }}
            </td>
            <td class="px-2 py-2 text-center font-mono text-xs">
              <span :class="isBattleIncomplete(battle) ? 'text-amber-400' : 'text-slate-400'">
                {{ battle.attackers_score }}:{{ battle.defenders_score }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
