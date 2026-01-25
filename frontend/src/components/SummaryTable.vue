<script setup>
import { WEAPON_ORDER } from "../constants/weaponOrder.js";

const props = defineProps({
  sortedSummary: {
    type: Array,
    required: true,
  },
  summarySortKey: {
    type: String,
    required: true,
  },
  summarySortAsc: {
    type: Boolean,
    required: true,
  },
  hasWeaponBreakdown: {
    type: Function,
    required: true,
  },
  isWeaponExpanded: {
    type: Function,
    required: true,
  },
  formatNumber: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["toggle-summary-sort", "toggle-weapon-breakdown", "open-player-details"]);
</script>

<template>
  <table class="w-full text-sm">
    <thead class="sticky top-0 bg-slate-900 text-slate-400 font-medium uppercase text-xs tracking-wider z-10">
      <tr>
        <th class="px-2 py-3 text-left w-12">#</th>
        <th
          class="px-4 py-3 text-left cursor-pointer hover:text-emerald-400 transition-colors select-none"
          @click="emit('toggle-summary-sort', 'player_name')"
        >
          <div class="flex items-center gap-1">
            Player
            <svg
              v-if="summarySortKey === 'player_name'"
              class="w-3 h-3 transition-transform"
              :class="{ 'rotate-180': !summarySortAsc }"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </div>
        </th>
        <th
          class="px-2 py-3 text-center cursor-pointer hover:text-emerald-400 transition-colors select-none w-10"
          title="Sort by Country"
          @click="emit('toggle-summary-sort', 'country_name')"
        >
          <div class="flex items-center justify-center gap-1">
            🏳️
            <svg
              v-if="summarySortKey === 'country_name'"
              class="w-3 h-3 transition-transform"
              :class="{ 'rotate-180': !summarySortAsc }"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </div>
        </th>
        <th
          class="px-4 py-3 text-left cursor-pointer hover:text-emerald-400 transition-colors select-none"
          @click="emit('toggle-summary-sort', 'side')"
        >
          <div class="flex items-center gap-1">
            Side
            <svg
              v-if="summarySortKey === 'side'"
              class="w-3 h-3 transition-transform"
              :class="{ 'rotate-180': !summarySortAsc }"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </div>
        </th>
        <th
          class="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-emerald-400 transition-colors select-none"
          @click="emit('toggle-summary-sort', 'total_damage')"
        >
          <div class="flex items-center justify-end gap-1">
            Total Damage
            <svg
              v-if="summarySortKey === 'total_damage'"
              class="w-3 h-3 transition-transform"
              :class="{ 'rotate-180': summarySortAsc }"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </div>
        </th>
        <th
          class="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:text-emerald-400 transition-colors select-none"
          @click="emit('toggle-summary-sort', 'hit_count')"
        >
          <div class="flex items-center justify-end gap-1">
            Hits
            <svg
              v-if="summarySortKey === 'hit_count'"
              class="w-3 h-3 transition-transform"
              :class="{ 'rotate-180': summarySortAsc }"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </div>
        </th>
        <th class="px-4 py-3 text-left">Weapon Breakdown</th>
      </tr>
    </thead>

    <tbody class="divide-y divide-slate-800/50">
      <template v-for="(player, index) in sortedSummary" :key="`${player.fighter_id}-${player.side}`">
        <tr class="hover:bg-slate-800/30 transition-colors group">
          <td class="px-2 py-3 font-mono text-slate-600 text-xs">{{ index + 1 }}</td>
          <td class="px-4 py-3">
            <button
              type="button"
              class="flex items-center gap-2 text-left group"
              @click="emit('open-player-details', player)"
            >
              <!-- Player avatar -->
              <img
                v-if="player.player_avatar"
                :src="player.player_avatar"
                :alt="player.player_name"
                class="w-8 h-8 rounded-full border border-slate-700 group-hover:border-emerald-500/50 transition-colors object-cover"
              />
              <!-- Fallback letter circle -->
              <div
                v-else
                class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700 group-hover:border-emerald-500/50 group-hover:text-emerald-400 transition-colors"
              >
                {{ (player.player_name || "P").charAt(0).toUpperCase() }}
              </div>
              <span
                class="text-slate-200 group-hover:text-white transition-colors underline-offset-2 group-hover:underline"
              >
                {{ player.player_name || `Player #${player.fighter_id}` }}
              </span>
            </button>
          </td>
          <td class="px-2 py-3 text-center">
            <div class="flex justify-center">
              <img
                v-if="player.country_avatar"
                :src="player.country_avatar"
                :alt="player.country_name"
                :title="player.country_name"
                class="w-6 h-4 object-cover rounded shadow-sm border border-slate-700/50"
              />
              <span v-else class="text-slate-600 text-[10px]">—</span>
            </div>
          </td>
          <td class="px-4 py-3">
            <span
              :class="
                player.side === 'ATTACKER'
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              "
              class="text-xs font-bold px-2 py-1 rounded border"
            >
              {{ player.side || "UNKNOWN" }}
            </span>
          </td>
          <td class="px-4 py-3 text-right font-mono text-emerald-400 font-medium whitespace-nowrap">
            {{ formatNumber(player.total_damage) }}
          </td>
          <td class="px-4 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
            {{ formatNumber(player.hit_count) }}
          </td>
          <td class="px-4 py-3">
            <button
              v-if="hasWeaponBreakdown(player)"
              type="button"
              class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
              :aria-expanded="isWeaponExpanded(player.fighter_id)"
              @click="emit('toggle-weapon-breakdown', player.fighter_id)"
            >
              <svg
                class="w-3.5 h-3.5 transition-transform"
                :class="{ 'rotate-90': isWeaponExpanded(player.fighter_id) }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
              <span>{{ isWeaponExpanded(player.fighter_id) ? "Hide breakdown" : "Show breakdown" }}</span>
            </button>
            <span v-else class="text-slate-600 text-xs">—</span>
          </td>
        </tr>
        <template v-if="hasWeaponBreakdown(player) && isWeaponExpanded(player.fighter_id)">
          <tr :key="`weapons-${player.fighter_id}`" class="bg-slate-900/40">
            <td colspan="7">
              <div class="flex flex-wrap gap-1.5 pt-2 justify-center">
                <template v-for="weapon in WEAPON_ORDER" :key="`${player.fighter_id}-${weapon}`">
                  <span
                    v-if="player.weapons && player.weapons[weapon]"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono"
                    :class="{
                      'bg-purple-500/20 text-purple-300 border border-purple-500/30': weapon.startsWith('WQ'),
                      'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30': weapon.startsWith('AQ'),
                      'bg-slate-700/50 text-slate-400 border border-slate-600': weapon === 'Hand',
                    }"
                    :title="`${weapon}: ${formatNumber(player.weapons[weapon].damage)} dmg (${player.weapons[weapon].hits} hits)`"
                  >
                    <span class="font-bold">{{ weapon }}</span>
                    <span class="text-[10px] opacity-75">{{ formatNumber(player.weapons[weapon].damage) }}</span>
                  </span>
                </template>
              </div>
            </td>
          </tr>
        </template>
      </template>
    </tbody>
  </table>
</template>
