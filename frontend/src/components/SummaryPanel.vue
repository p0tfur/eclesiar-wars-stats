<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import SummaryTable from "./SummaryTable.vue";
import CountryDetailsModal from "./CountryDetailsModal.vue";
import { WEAPON_ORDER } from "../constants/weaponOrder.js";
import { buildCountryStats } from "../utils/countryStats.js";

const props = defineProps({
  summary: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["open-player-details"]);

const SUMMARY_VIEW = {
  PLAYER: "player",
  COUNTRY: "country",
  MU: "mu",
};

// Summary table sorting state
const summarySortKey = ref("total_damage");
const summarySortAsc = ref(false);
const summaryView = ref(SUMMARY_VIEW.PLAYER);

// Weapon breakdown state
const expandedRows = ref(new Set());

// Summary country filter state
const summaryCountryFilter = ref([]);
const summaryCountrySearch = ref("");
const summaryCountryDropdownOpen = ref(false);
const summaryCountryTriggerRef = ref(null);
const summaryCountryDropdownPosition = ref({ top: 0, left: 0, width: 0 });
const countryDetailsOpen = ref(false);
const selectedCountry = ref(null);

const hasMilitaryUnitData = computed(() =>
  props.summary.some((row) => row?.military_unit_id || row?.military_unit_name),
);

const summaryViewOptions = computed(() => {
  const options = [
    { key: SUMMARY_VIEW.PLAYER, label: "By player" },
    { key: SUMMARY_VIEW.COUNTRY, label: "By country" },
  ];

  if (hasMilitaryUnitData.value) {
    options.push({ key: SUMMARY_VIEW.MU, label: "By MU" });
  }

  return options;
});

const activeViewMeta = computed(
  () => summaryViewOptions.value.find((option) => option.key === summaryView.value) || summaryViewOptions.value[0],
);

const primaryColumnLabel = computed(() => {
  if (summaryView.value === SUMMARY_VIEW.COUNTRY) {
    return "Country";
  }

  if (summaryView.value === SUMMARY_VIEW.MU) {
    return "Military Unit";
  }

  return "Player";
});

const summaryItemLabel = computed(() => {
  if (summaryView.value === SUMMARY_VIEW.COUNTRY) {
    return "countries";
  }

  if (summaryView.value === SUMMARY_VIEW.MU) {
    return "military units";
  }

  return "players";
});

const showCountryColumn = computed(() => summaryView.value === SUMMARY_VIEW.PLAYER);

const hasWeaponBreakdown = (row) => !!row?.weapons && Object.keys(row.weapons).length > 0;

function isWeaponExpanded(rowId) {
  if (!rowId) {
    return false;
  }
  return expandedRows.value.has(rowId);
}

function toggleWeaponBreakdown(rowId) {
  if (!rowId) {
    return;
  }
  const next = new Set(expandedRows.value);
  if (next.has(rowId)) {
    next.delete(rowId);
  } else {
    next.add(rowId);
  }
  expandedRows.value = next;
}

function toggleAllWeaponBreakdowns(targetState) {
  if (targetState) {
    const next = new Set(rowsWithWeaponBreakdown.value.map((row) => row.row_id));
    expandedRows.value = next;
  } else {
    expandedRows.value = new Set();
  }
}

function formatNumber(num) {
  return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") || "0";
}

function normalizeTextValue(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeCountryKey(value) {
  return normalizeTextValue(value, "Unknown country").toLowerCase();
}

function buildSideLabel(sideSet) {
  const sides = Array.from(sideSet).filter(Boolean);
  if (sides.length === 1) {
    return sides[0];
  }
  if (sides.length > 1) {
    return "MIXED";
  }
  return "UNKNOWN";
}

function mergeWeapons(target, source) {
  if (!source) {
    return;
  }

  Object.entries(source).forEach(([weapon, data]) => {
    if (!target[weapon]) {
      target[weapon] = { damage: 0, hits: 0 };
    }

    target[weapon].damage += Number(data?.damage) || 0;
    target[weapon].hits += Number(data?.hits) || 0;
  });
}

function buildPlayerRows(summaryRows) {
  return summaryRows.map((player) => ({
    ...player,
    row_id: `player-${player.fighter_id}-${player.side || "unknown"}`,
    row_type: SUMMARY_VIEW.PLAYER,
    display_name: player.player_name || `Player #${player.fighter_id}`,
    display_avatar: player.player_avatar || null,
    can_open_details: Boolean(player.fighter_id),
  }));
}

function buildCountryRows(summaryRows) {
  const countryMap = new Map();

  summaryRows.forEach((player) => {
    const countryName = normalizeTextValue(player.country_name, "Unknown country");
    const countryKey = `country-${normalizeCountryKey(countryName)}`;

    if (!countryMap.has(countryKey)) {
      countryMap.set(countryKey, {
        row_id: countryKey,
        row_type: SUMMARY_VIEW.COUNTRY,
        display_name: countryName,
        display_avatar: player.country_avatar || null,
        country_name: countryName,
        country_avatar: player.country_avatar || null,
        nationality_id: player.nationality_id || null,
        total_damage: 0,
        hit_count: 0,
        weapons: {},
        can_open_details: true,
        _sideSet: new Set(),
      });
    }

    const country = countryMap.get(countryKey);
    country.total_damage += Number(player.total_damage) || 0;
    country.hit_count += Number(player.hit_count) || 0;
    mergeWeapons(country.weapons, player.weapons);
    if (player.side) {
      country._sideSet.add(player.side);
    }
  });

  return Array.from(countryMap.values()).map((country) => ({
    ...country,
    side: buildSideLabel(country._sideSet),
  }));
}

function buildMilitaryUnitRows(summaryRows) {
  const muMap = new Map();

  summaryRows.forEach((player) => {
    const muName = normalizeTextValue(player.military_unit_name, "Unknown MU");
    const muKey = player.military_unit_id ? `mu-${player.military_unit_id}` : `mu-${muName}`;

    if (!muMap.has(muKey)) {
      muMap.set(muKey, {
        row_id: muKey,
        row_type: SUMMARY_VIEW.MU,
        display_name: muName,
        display_avatar: null,
        military_unit_name: muName,
        military_unit_id: player.military_unit_id || null,
        total_damage: 0,
        hit_count: 0,
        weapons: {},
        can_open_details: false,
        _sideSet: new Set(),
      });
    }

    const mu = muMap.get(muKey);
    mu.total_damage += Number(player.total_damage) || 0;
    mu.hit_count += Number(player.hit_count) || 0;
    mergeWeapons(mu.weapons, player.weapons);
    if (player.side) {
      mu._sideSet.add(player.side);
    }
  });

  return Array.from(muMap.values()).map((mu) => ({
    ...mu,
    side: buildSideLabel(mu._sideSet),
  }));
}

const baseSummaryRows = computed(() => {
  if (summaryView.value === SUMMARY_VIEW.COUNTRY) {
    return buildCountryRows(props.summary);
  }

  if (summaryView.value === SUMMARY_VIEW.MU) {
    return buildMilitaryUnitRows(props.summary);
  }

  return buildPlayerRows(props.summary);
});

const availableSummaryCountries = computed(() => {
  const countries = new Set();
  props.summary.forEach((player) => {
    const countryName = normalizeTextValue(player.country_name, "");
    if (countryName) {
      countries.add(countryName);
    }
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

const filteredSummaryRows = computed(() => {
  if (summaryCountryFilter.value.length === 0) {
    return baseSummaryRows.value;
  }

  return baseSummaryRows.value.filter((row) => summaryCountryFilter.value.includes(row.country_name));
});

const rowsWithWeaponBreakdown = computed(() => filteredSummaryRows.value.filter((row) => hasWeaponBreakdown(row)));

const allWeaponBreakdownsExpanded = computed(() => {
  const rows = rowsWithWeaponBreakdown.value;
  if (!rows.length) {
    return false;
  }
  return rows.every((row) => expandedRows.value.has(row.row_id));
});

const sortedSummary = computed(() => {
  const filtered = [...filteredSummaryRows.value];

  filtered.sort((a, b) => {
    const aRaw = a[summarySortKey.value];
    const bRaw = b[summarySortKey.value];
    const aText = typeof aRaw === "string" ? aRaw : "";
    const bText = typeof bRaw === "string" ? bRaw : "";

    if (aText || bText) {
      return summarySortAsc.value ? aText.localeCompare(bText) : bText.localeCompare(aText);
    }

    const aVal = Number(aRaw) || 0;
    const bVal = Number(bRaw) || 0;
    return summarySortAsc.value ? aVal - bVal : bVal - aVal;
  });

  return filtered;
});

const selectedCountryStats = computed(() => {
  return buildCountryStats(selectedCountry.value, props.summary, normalizeCountryKey);
});

function toggleSummarySort(key) {
  if (summarySortKey.value === key) {
    summarySortAsc.value = !summarySortAsc.value;
  } else {
    summarySortKey.value = key;
    summarySortAsc.value = key === "display_name";
  }
}

function setSummaryView(viewKey) {
  summaryView.value = viewKey;
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
  if (!sortedSummary.value.length) {
    return;
  }

  const headers = [
    "Rank",
    primaryColumnLabel.value,
    "Side",
    "Total Damage",
    "Hits",
    ...WEAPON_ORDER.map((w) => `${w} Damage`),
    ...WEAPON_ORDER.map((w) => `${w} Hits`),
  ];

  if (summaryView.value === SUMMARY_VIEW.PLAYER) {
    headers.splice(2, 0, "Country");
  }

  const rows = sortedSummary.value.map((row, index) => {
    const baseRow = [index + 1, row.display_name];

    if (summaryView.value === SUMMARY_VIEW.PLAYER) {
      baseRow.push(row.country_name || "");
    }

    baseRow.push(row.side, row.total_damage, row.hit_count);

    const weaponDamage = WEAPON_ORDER.map((w) => row.weapons?.[w]?.damage || 0);
    const weaponHits = WEAPON_ORDER.map((w) => row.weapons?.[w]?.hits || 0);

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
  link.setAttribute("download", `war-summary-${summaryView.value}-${new Date().toISOString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleOpenDetails(row) {
  if (!row?.can_open_details) {
    return;
  }

  if (row.row_type === SUMMARY_VIEW.COUNTRY) {
    selectedCountry.value = row;
    countryDetailsOpen.value = true;
    return;
  }

  emit("open-player-details", row);
}

function closeCountryDetails() {
  countryDetailsOpen.value = false;
}

watch(summaryCountryDropdownOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    setDropdownPosition(summaryCountryTriggerRef, summaryCountryDropdownPosition);
  }
});

watch(summaryViewOptions, (options) => {
  if (!options.some((option) => option.key === summaryView.value)) {
    summaryView.value = SUMMARY_VIEW.PLAYER;
  }
});

watch(summaryView, () => {
  expandedRows.value = new Set();

  if (summaryView.value === SUMMARY_VIEW.PLAYER) {
    if (summarySortKey.value === "display_name" || summarySortKey.value === "country_name") {
      return;
    }
  }

  if (summarySortKey.value !== "total_damage" && summarySortKey.value !== "hit_count" && summarySortKey.value !== "side") {
    summarySortKey.value = "total_damage";
    summarySortAsc.value = false;
  }
});

watch(
  () => props.summary,
  () => {
    expandedRows.value = new Set();
    summaryCountryFilter.value = [];
    summaryCountrySearch.value = "";
    if (selectedCountry.value) {
      const stillExists = props.summary.some(
        (player) => normalizeCountryKey(player.country_name) === normalizeCountryKey(selectedCountry.value.country_name),
      );
      if (!stillExists) {
        countryDetailsOpen.value = false;
        selectedCountry.value = null;
      }
    }
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
    <div class="flex flex-col gap-4 mb-4 xl:flex-row xl:items-start xl:justify-between">
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

      <div class="flex flex-col items-stretch gap-3 xl:items-end">
        <div class="inline-flex self-start rounded-xl border border-slate-700 bg-slate-950/70 p-1 shadow-inner">
          <button
            v-for="option in summaryViewOptions"
            :key="option.key"
            type="button"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
            :class="
              summaryView === option.key
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent'
            "
            @click="setSummaryView(option.key)"
          >
            {{ option.label }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-3 xl:justify-end">
          <span v-if="summary.length" class="text-sm text-slate-400 font-mono">
            {{ sortedSummary.length
            }}<span v-if="summaryCountryFilter.length" class="text-emerald-400">/{{ baseSummaryRows.length }}</span>
            {{ summaryItemLabel }}
          </span>

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

            <Teleport to="body">
              <div
                v-if="summaryCountryDropdownOpen"
                data-dropdown-panel="summary-country"
                class="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[200px]"
                :style="summaryCountryDropdownStyle"
                @click.stop
              >
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
            :disabled="!rowsWithWeaponBreakdown.length"
            @click="toggleAllWeaponBreakdowns(!allWeaponBreakdownsExpanded)"
          >
            {{ allWeaponBreakdownsExpanded ? "Collapse all" : "Expand all" }}
          </button>
          <button
            class="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 hover:border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            :disabled="!sortedSummary.length"
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
    </div>

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

    <div v-else class="overflow-x-auto min-h-[500px] overflow-y-auto">
      <SummaryTable
        :sorted-summary="sortedSummary"
        :summary-sort-key="summarySortKey"
        :summary-sort-asc="summarySortAsc"
        :primary-column-label="primaryColumnLabel"
        :show-country-column="showCountryColumn"
        :active-view-key="activeViewMeta.key"
        :has-weapon-breakdown="hasWeaponBreakdown"
        :is-weapon-expanded="isWeaponExpanded"
        :format-number="formatNumber"
        @toggle-summary-sort="toggleSummarySort"
        @toggle-weapon-breakdown="toggleWeaponBreakdown"
        @open-player-details="handleOpenDetails"
      />
    </div>

    <CountryDetailsModal
      :is-open="countryDetailsOpen"
      :stats="selectedCountryStats"
      :format-number="formatNumber"
      @close="closeCountryDetails"
      @open-player-details="emit('open-player-details', $event)"
    />
  </div>
</template>
