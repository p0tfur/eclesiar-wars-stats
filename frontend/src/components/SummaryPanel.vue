<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import SummaryTable from "./SummaryTable.vue";
import { WEAPON_ORDER } from "../constants/weaponOrder.js";

const props = defineProps({
  summary: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["open-player-details"]);

// Summary table sorting state
const summarySortKey = ref("total_damage");
const summarySortAsc = ref(false);

// Weapon breakdown state
const expandedPlayers = ref(new Set());

// Summary country filter state
const summaryCountryFilter = ref([]);
const summaryCountrySearch = ref("");
const summaryCountryDropdownOpen = ref(false);
const summaryCountryTriggerRef = ref(null);
const summaryCountryDropdownPosition = ref({ top: 0, left: 0, width: 0 });

const hasWeaponBreakdown = (player) => !!player?.weapons && Object.keys(player.weapons).length > 0;

function isWeaponExpanded(fighterId) {
  if (!fighterId) {
    return false;
  }
  return expandedPlayers.value.has(fighterId);
}

function toggleWeaponBreakdown(fighterId) {
  if (!fighterId) {
    return;
  }
  const next = new Set(expandedPlayers.value);
  if (next.has(fighterId)) {
    next.delete(fighterId);
  } else {
    next.add(fighterId);
  }
  expandedPlayers.value = next;
}

function toggleAllWeaponBreakdowns(targetState) {
  if (targetState) {
    const next = new Set(playersWithWeaponBreakdown.value.map((player) => player.fighter_id));
    expandedPlayers.value = next;
  } else {
    expandedPlayers.value = new Set();
  }
}

// Format large numbers with spaces
function formatNumber(num) {
  return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") || "0";
}

// Summary country filter computed properties
const availableSummaryCountries = computed(() => {
  const countries = new Set();
  props.summary.forEach((player) => {
    if (player.country_name) countries.add(player.country_name);
  });
  return Array.from(countries).sort();
});

const filteredSummaryCountryOptions = computed(() => {
  if (!summaryCountrySearch.value.trim()) {
    return availableSummaryCountries.value;
  }
  const query = summaryCountrySearch.value.toLowerCase();
  return availableSummaryCountries.value.filter((c) => c.toLowerCase().includes(query));
});

const summaryCountryDropdownStyle = computed(() => ({
  top: `${summaryCountryDropdownPosition.value.top}px`,
  left: `${summaryCountryDropdownPosition.value.left}px`,
  width: `${summaryCountryDropdownPosition.value.width}px`,
}));

const playersWithWeaponBreakdown = computed(() => props.summary.filter((player) => hasWeaponBreakdown(player)));

const allWeaponBreakdownsExpanded = computed(() => {
  const players = playersWithWeaponBreakdown.value;
  if (!players.length) {
    return false;
  }
  return players.every((player) => expandedPlayers.value.has(player.fighter_id));
});

// Sorted summary based on current sort key (with country filter applied)
const sortedSummary = computed(() => {
  let filtered = [...props.summary];

  // Apply country filter
  if (summaryCountryFilter.value.length > 0) {
    filtered = filtered.filter((player) => summaryCountryFilter.value.includes(player.country_name));
  }

  filtered.sort((a, b) => {
    let aVal = a[summarySortKey.value];
    let bVal = b[summarySortKey.value];

    // Handle string comparison
    if (typeof aVal === "string" && typeof bVal === "string") {
      return summarySortAsc.value ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    // Handle numeric comparison
    aVal = Number(aVal) || 0;
    bVal = Number(bVal) || 0;
    return summarySortAsc.value ? aVal - bVal : bVal - aVal;
  });
  return filtered;
});

// Function to toggle sort on a column
function toggleSummarySort(key) {
  if (summarySortKey.value === key) {
    summarySortAsc.value = !summarySortAsc.value;
  } else {
    summarySortKey.value = key;
    summarySortAsc.value = key === "player_name"; // Default asc for text, desc for numbers
  }
}

function toggleSummaryCountryOption(option) {
  if (summaryCountryFilter.value.includes(option)) {
    summaryCountryFilter.value = summaryCountryFilter.value.filter((c) => c !== option);
  } else {
    summaryCountryFilter.value = [...summaryCountryFilter.value, option];
  }
}

function clearSummaryCountryFilter() {
  summaryCountryFilter.value = [];
  summaryCountrySearch.value = "";
}

function setDropdownPosition(triggerRef, positionRef) {
  const el = triggerRef.value;
  if (!el) {
    return;
  }
  const rect = el.getBoundingClientRect();
  positionRef.value = {
    top: rect.bottom + window.scrollY + 6,
    left: rect.left + window.scrollX,
    width: rect.width,
  };
}

function updateDropdownPositions() {
  if (summaryCountryDropdownOpen.value) {
    setDropdownPosition(summaryCountryTriggerRef, summaryCountryDropdownPosition);
  }
}

function closeDropdowns(event) {
  const target = event?.target;
  const insideContainer = target?.closest?.(".multiselect-container");
  const insideDropdown = target?.closest?.("[data-dropdown-panel='summary-country']");
  if (!insideContainer && !insideDropdown) {
    summaryCountryDropdownOpen.value = false;
  }
}

function exportSummaryCsv() {
  if (!props.summary.length) {
    return;
  }

  // Build headers with weapon columns
  const headers = [
    "Rank",
    "Player",
    "Country",
    "Side",
    "Total Damage",
    "Hits",
    ...WEAPON_ORDER.map((w) => `${w} Damage`),
    ...WEAPON_ORDER.map((w) => `${w} Hits`),
  ];

  const rows = props.summary.map((player, index) => {
    const baseRow = [
      index + 1,
      player.player_name || `Player #${player.fighter_id}`,
      player.country_name || "",
      player.side,
      player.total_damage,
      player.hit_count,
    ];

    // Add weapon damage columns
    const weaponDamage = WEAPON_ORDER.map((w) => player.weapons?.[w]?.damage || 0);
    // Add weapon hits columns
    const weaponHits = WEAPON_ORDER.map((w) => player.weapons?.[w]?.hits || 0);

    return [...baseRow, ...weaponDamage, ...weaponHits];
  });

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => {
          const stringValue = value ?? "";
          return `"${String(stringValue).replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `war-summary-${new Date().toISOString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

watch(summaryCountryDropdownOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    setDropdownPosition(summaryCountryTriggerRef, summaryCountryDropdownPosition);
  }
});

// Reset summary country filter when summary changes
watch(
  () => props.summary,
  () => {
    expandedPlayers.value = new Set();
    summaryCountryFilter.value = [];
    summaryCountrySearch.value = "";
  },
);

onMounted(() => {
  document.addEventListener("click", closeDropdowns);
  window.addEventListener("scroll", updateDropdownPositions, true);
  window.addEventListener("resize", updateDropdownPositions);
});

onUnmounted(() => {
  document.removeEventListener("click", closeDropdowns);
  window.removeEventListener("scroll", updateDropdownPositions, true);
  window.removeEventListener("resize", updateDropdownPositions);
});
</script>

<template>
  <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-sm">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-semibold text-white flex items-center gap-2">
          <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            ></path>
          </svg>
          War Summary
        </h2>
        <p class="text-sm text-slate-500">Aggregated damage from selected battles</p>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="summary.length" class="text-sm text-slate-400 font-mono">
          {{ sortedSummary.length
          }}<span v-if="summaryCountryFilter.length" class="text-emerald-400">/{{ summary.length }}</span>
          players
        </span>

        <!-- Country filter dropdown for summary -->
        <div v-if="availableSummaryCountries.length > 0" class="multiselect-container relative">
          <button
            ref="summaryCountryTriggerRef"
            type="button"
            class="flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 hover:border-emerald-500/30 transition-colors"
            @click.stop="summaryCountryDropdownOpen = !summaryCountryDropdownOpen"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              ></path>
            </svg>
            <span v-if="summaryCountryFilter.length">{{ summaryCountryFilter.length }} countries</span>
            <span v-else>Filter by country</span>
            <svg
              class="w-3 h-3 transition-transform"
              :class="{ 'rotate-180': summaryCountryDropdownOpen }"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </button>

          <!-- Dropdown panel -->
          <Teleport to="body">
            <div
              v-if="summaryCountryDropdownOpen"
              data-dropdown-panel="summary-country"
              class="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[200px]"
              :style="summaryCountryDropdownStyle"
              @click.stop
            >
              <!-- Search -->
              <div class="p-2 border-b border-slate-700">
                <div class="relative">
                  <svg
                    class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    ></path>
                  </svg>
                  <input
                    v-model="summaryCountrySearch"
                    type="text"
                    placeholder="Search..."
                    class="w-full pl-8 pr-8 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    @click.stop
                  />
                  <button
                    v-if="summaryCountrySearch"
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded"
                    @click.stop="summaryCountrySearch = ''"
                    type="button"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Options -->
              <div class="max-h-60 overflow-y-auto">
                <template v-if="filteredSummaryCountryOptions.length">
                  <button
                    v-for="country in filteredSummaryCountryOptions"
                    :key="country"
                    type="button"
                    class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-700/60 transition-colors"
                    :class="{ 'bg-emerald-500/10': summaryCountryFilter.includes(country) }"
                    @click.stop="toggleSummaryCountryOption(country)"
                  >
                    <span
                      class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                      :class="
                        summaryCountryFilter.includes(country)
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-slate-500'
                      "
                    >
                      <svg
                        v-if="summaryCountryFilter.includes(country)"
                        class="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </span>
                    <span class="text-sm text-slate-200">{{ country }}</span>
                  </button>
                </template>
                <div v-else class="px-3 py-4 text-center text-sm text-slate-500">
                  No countries match "{{ summaryCountrySearch }}"
                </div>
              </div>

              <!-- Footer -->
              <div v-if="summaryCountryFilter.length" class="p-2 border-t border-slate-700 bg-slate-800/80">
                <button
                  type="button"
                  class="w-full px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                  @click.stop="clearSummaryCountryFilter"
                >
                  Clear selection ({{ summaryCountryFilter.length }})
                </button>
              </div>
            </div>
          </Teleport>
        </div>

        <button
          class="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 hover:border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          :disabled="!playersWithWeaponBreakdown.length"
          @click="toggleAllWeaponBreakdowns(!allWeaponBreakdownsExpanded)"
        >
          {{ allWeaponBreakdownsExpanded ? "Collapse all" : "Expand all" }}
        </button>
        <button
          class="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 hover:border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          :disabled="!summary.length"
          @click="exportSummaryCsv"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            ></path>
          </svg>
          Export CSV
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="summary.length === 0" class="text-center py-12 text-slate-500">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        ></path>
      </svg>
      <p>Select battles and click "Generate Summary" to see damage totals.</p>
    </div>

    <!-- Summary table -->
    <div v-else class="overflow-x-auto min-h-[500px] overflow-y-auto">
      <SummaryTable
        :sorted-summary="sortedSummary"
        :summary-sort-key="summarySortKey"
        :summary-sort-asc="summarySortAsc"
        :has-weapon-breakdown="hasWeaponBreakdown"
        :is-weapon-expanded="isWeaponExpanded"
        :format-number="formatNumber"
        @toggle-summary-sort="toggleSummarySort"
        @toggle-weapon-breakdown="toggleWeaponBreakdown"
        @open-player-details="emit('open-player-details', $event)"
      />
    </div>
  </div>
</template>
