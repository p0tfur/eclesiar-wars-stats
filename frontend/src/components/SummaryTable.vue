<script setup>
import { computed } from "vue";
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
  primaryColumnLabel: {
    type: String,
    required: true,
  },
  showCountryColumn: {
    type: Boolean,
    required: true,
  },
  activeViewKey: {
    type: String,
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

const showPrimaryAvatarColumn = computed(() => props.activeViewKey !== "mu");

function sideBadgeClass(side) {
  if (side === "ATTACKER") {
    return "bg-red-500/10 text-red-400 border-red-500/20";
  }

  if (side === "DEFENDER") {
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  }

  if (side === "MIXED") {
    return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  }

  return "bg-slate-500/10 text-slate-400 border-slate-500/20";
}
</script>

<template>
  <table class="w-full text-sm">
    <thead class="sticky top-0 bg-slate-900 text-slate-400 font-medium uppercase text-xs tracking-wider z-10">
      <tr>
        <th class="px-2 py-3 text-left w-12">#</th>
        <th
          class="px-4 py-3 text-left cursor-pointer hover:text-emerald-400 transition-colors select-none"
          @click="emit('toggle-summary-sort', 'display_name')"
        >
          <div class="flex items-center gap-1">
            {{ primaryColumnLabel }}
            <svg
              v-if="summarySortKey === 'display_name'"
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
          v-if="showPrimaryAvatarColumn"
          class="px-2 py-3 text-center cursor-pointer hover:text-emerald-400 transition-colors select-none w-10"
          :title="showCountryColumn ? 'Sort by Country' : `Sort by ${primaryColumnLabel}`"
          @click="emit('toggle-summary-sort', showCountryColumn ? 'country_name' : 'display_name')"
        >
          <div class="flex items-center justify-center gap-1">
            {{ showCountryColumn ? "Flag" : "Icon" }}
            <svg
              v-if="
                summarySortKey === (showCountryColumn ? 'country_name' : 'display_name')
              "
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
      <template v-for="(row, index) in sortedSummary" :key="row.row_id">
        <tr class="hover:bg-slate-800/30 transition-colors group">
          <td class="px-2 py-3 font-mono text-slate-600 text-xs">{{ index + 1 }}</td>
          <td class="px-4 py-3">
            <button
              v-if="row.can_open_details"
              type="button"
              class="flex items-center gap-2 text-left group"
              @click="emit('open-player-details', row)"
            >
              <img
                v-if="row.display_avatar"
                :src="row.display_avatar"
                :alt="row.display_name"
                class="w-8 h-8 rounded-full border border-slate-700 group-hover:border-emerald-500/50 transition-colors object-cover"
              />
              <div
                v-else
                class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700 group-hover:border-emerald-500/50 group-hover:text-emerald-400 transition-colors"
              >
                {{ (row.display_name || "U").charAt(0).toUpperCase() }}
              </div>
              <span
                class="text-slate-200 group-hover:text-white transition-colors underline-offset-2 group-hover:underline"
              >
                {{ row.display_name }}
              </span>
            </button>

            <div v-else class="flex items-center gap-2">
              <div
                v-if="row.display_avatar"
                class="w-8 h-8 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center"
              >
                <img :src="row.display_avatar" :alt="row.display_name" class="w-full h-full object-cover" />
              </div>
              <div
                v-else
                class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700"
              >
                {{ (row.display_name || "U").charAt(0).toUpperCase() }}
              </div>
              <span class="text-slate-200">
                {{ row.display_name }}
              </span>
            </div>
          </td>
          <td v-if="showPrimaryAvatarColumn" class="px-2 py-3 text-center">
            <div class="flex justify-center">
              <img
                v-if="showCountryColumn ? row.country_avatar : row.display_avatar"
                :src="showCountryColumn ? row.country_avatar : row.display_avatar"
                :alt="showCountryColumn ? row.country_name : row.display_name"
                :title="showCountryColumn ? row.country_name : row.display_name"
                class="w-6 h-4 object-cover rounded shadow-sm border border-slate-700/50"
              />
              <span v-else class="text-slate-600 text-[10px]">-</span>
            </div>
          </td>
          <td class="px-4 py-3">
            <span :class="sideBadgeClass(row.side)" class="text-xs font-bold px-2 py-1 rounded border">
              {{ row.side || "UNKNOWN" }}
            </span>
          </td>
          <td class="px-4 py-3 text-right font-mono text-emerald-400 font-medium whitespace-nowrap">
            {{ formatNumber(row.total_damage) }}
          </td>
          <td class="px-4 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
            {{ formatNumber(row.hit_count) }}
          </td>
          <td class="px-4 py-3">
            <button
              v-if="hasWeaponBreakdown(row)"
              type="button"
              class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
              :aria-expanded="isWeaponExpanded(row.row_id)"
              @click="emit('toggle-weapon-breakdown', row.row_id)"
            >
              <svg
                class="w-3.5 h-3.5 transition-transform"
                :class="{ 'rotate-90': isWeaponExpanded(row.row_id) }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
              <span>{{ isWeaponExpanded(row.row_id) ? "Hide breakdown" : "Show breakdown" }}</span>
            </button>
            <span v-else class="text-slate-600 text-xs">-</span>
          </td>
        </tr>
        <template v-if="hasWeaponBreakdown(row) && isWeaponExpanded(row.row_id)">
          <tr :key="`weapons-${row.row_id}`" class="bg-slate-900/40">
            <td :colspan="showPrimaryAvatarColumn ? 7 : 6">
              <div class="flex flex-wrap gap-1.5 pt-2 justify-center">
                <template v-for="weapon in WEAPON_ORDER" :key="`${row.row_id}-${weapon}`">
                  <span
                    v-if="row.weapons && row.weapons[weapon]"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono"
                    :class="{
                      'bg-purple-500/20 text-purple-300 border border-purple-500/30': weapon.startsWith('WQ'),
                      'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30': weapon.startsWith('AQ'),
                      'bg-slate-700/50 text-slate-400 border border-slate-600': weapon === 'Hand',
                    }"
                    :title="`${weapon}: ${formatNumber(row.weapons[weapon].damage)} dmg (${row.weapons[weapon].hits} hits)`"
                  >
                    <span class="font-bold">{{ weapon }}</span>
                    <span class="text-[10px] opacity-75">{{ formatNumber(row.weapons[weapon].damage) }}</span>
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
