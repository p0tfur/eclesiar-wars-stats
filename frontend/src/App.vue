<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { getBattles, fetchBattle, fetchBattleRange, getFetchProgress, getWarSummary, deleteBattle } from "./api.js";

// State
const battles = ref([]);
const selectedBattleIds = ref([]);
const summary = ref([]);
const loading = ref(false);
const fetchingBattle = ref(false);
const loadingSummary = ref(false);
const newBattleId = ref("");
const API_KEY_STORAGE_KEY = "eclesiar_api_key";
const userApiKey = ref(typeof window !== "undefined" ? localStorage.getItem(API_KEY_STORAGE_KEY) || "" : "");
const error = ref("");

// Range fetch state
const rangeFromId = ref("");
const rangeToId = ref("");
const fetchProgress = ref(null);
let progressInterval = null;

// Country filter state (include)
const countryFilters = ref([]);
const excludedFilterBattleIds = ref([]);
const countrySearch = ref("");
const includeDropdownOpen = ref(false);
const includeTriggerRef = ref(null);
const includeDropdownPosition = ref({ top: 0, left: 0, width: 0 });

// Country exclude filter state
const excludeCountryFilters = ref([]);
const excludeCountrySearch = ref("");
const excludeDropdownOpen = ref(false);
const excludeTriggerRef = ref(null);
const excludeDropdownPosition = ref({ top: 0, left: 0, width: 0 });

// Computed
const availableCountries = computed(() => {
  const names = new Set();
  battles.value.forEach((battle) => {
    if (battle.attacker_name) names.add(battle.attacker_name);
    if (battle.defender_name) names.add(battle.defender_name);
  });
  return Array.from(names).sort();
});

const filteredCountryOptions = computed(() => {
  const base = availableCountries.value.filter((c) => !excludeCountryFilters.value.includes(c));
  if (!countrySearch.value.trim()) {
    return base;
  }
  const query = countrySearch.value.toLowerCase();
  return base.filter((country) => country.toLowerCase().includes(query));
});

const filteredExcludeCountryOptions = computed(() => {
  const base = availableCountries.value.filter((c) => !countryFilters.value.includes(c));
  if (!excludeCountrySearch.value.trim()) {
    return base;
  }
  const query = excludeCountrySearch.value.toLowerCase();
  return base.filter((country) => country.toLowerCase().includes(query));
});

const includeDropdownStyle = computed(() => ({
  top: `${includeDropdownPosition.value.top}px`,
  left: `${includeDropdownPosition.value.left}px`,
  width: `${includeDropdownPosition.value.width}px`,
}));

const excludeDropdownStyle = computed(() => ({
  top: `${excludeDropdownPosition.value.top}px`,
  left: `${excludeDropdownPosition.value.left}px`,
  width: `${excludeDropdownPosition.value.width}px`,
}));

const filteredBattleIds = computed(() => {
  let result = battles.value;

  // Apply include filter
  if (countryFilters.value.length) {
    result = result.filter(
      (battle) =>
        countryFilters.value.includes(battle.attacker_name) || countryFilters.value.includes(battle.defender_name)
    );
  }

  // Apply exclude filter
  if (excludeCountryFilters.value.length) {
    result = result.filter(
      (battle) =>
        !excludeCountryFilters.value.includes(battle.attacker_name) &&
        !excludeCountryFilters.value.includes(battle.defender_name)
    );
  }

  if (!countryFilters.value.length && !excludeCountryFilters.value.length) {
    return [];
  }

  return result.map((battle) => battle.id);
});

const displayedBattles = computed(() => {
  if (!countryFilters.value.length && !excludeCountryFilters.value.length) {
    return battles.value;
  }
  const allowed = new Set(filteredBattleIds.value);
  return battles.value.filter((battle) => allowed.has(battle.id));
});

const filterSelectedBattleIds = computed(() =>
  filteredBattleIds.value.filter((id) => !excludedFilterBattleIds.value.includes(id))
);

const combinedBattleIds = computed(() => {
  const combined = new Set(selectedBattleIds.value);
  filterSelectedBattleIds.value.forEach((id) => combined.add(id));
  return Array.from(combined);
});

const hasSelectedBattles = computed(() => combinedBattleIds.value.length > 0);

watch(filteredBattleIds, (newIds) => {
  excludedFilterBattleIds.value = excludedFilterBattleIds.value.filter((id) => newIds.includes(id));
});

// Format large numbers with spaces
function formatNumber(num) {
  return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") || "0";
}

// Load battles from database
async function loadBattles() {
  loading.value = true;
  error.value = "";
  try {
    const response = await getBattles();
    if (response.success) {
      battles.value = response.data;
    }
  } catch (err) {
    error.value = "Failed to load battles: " + err.message;
    console.log("Error loading battles:", err);
  } finally {
    loading.value = false;
  }
}

// Fetch new battle from API
async function handleFetchBattle() {
  if (!newBattleId.value) return;

  fetchingBattle.value = true;
  error.value = "";
  try {
    const response = await fetchBattle(parseInt(newBattleId.value), userApiKey.value.trim() || undefined);
    if (response.success) {
      newBattleId.value = "";
      await loadBattles();
    }
  } catch (err) {
    error.value = "Failed to fetch battle: " + err.message;
    console.log("Error fetching battle:", err);
  } finally {
    fetchingBattle.value = false;
  }
}

// Fetch range of battles from API
async function handleFetchRange() {
  if (!rangeFromId.value || !rangeToId.value) return;

  const fromId = parseInt(rangeFromId.value);
  const toId = parseInt(rangeToId.value);

  if (fromId > toId) {
    error.value = "From ID must be less than or equal to To ID";
    return;
  }

  error.value = "";
  try {
    const response = await fetchBattleRange(fromId, toId, userApiKey.value.trim() || undefined);
    if (response.success) {
      // Start polling for progress
      startProgressPolling();
    }
  } catch (err) {
    error.value = "Failed to start range fetch: " + err.message;
    console.log("Error starting range fetch:", err);
  }
}

// Poll for fetch progress
function startProgressPolling() {
  if (progressInterval) clearInterval(progressInterval);

  progressInterval = setInterval(async () => {
    try {
      const response = await getFetchProgress();
      if (response.success) {
        fetchProgress.value = response.data;

        // Stop polling when done
        if (!response.data.isRunning) {
          clearInterval(progressInterval);
          progressInterval = null;
          rangeFromId.value = "";
          rangeToId.value = "";
          await loadBattles();
        }
      }
    } catch (err) {
      console.log("Error polling progress:", err);
    }
  }, 1000);
}

// Delete a battle
async function handleDeleteBattle(battleId) {
  if (!confirm("Are you sure you want to delete this battle?")) return;

  try {
    await deleteBattle(battleId);
    selectedBattleIds.value = selectedBattleIds.value.filter((id) => id !== battleId);
    await loadBattles();
    // Clear summary if no battles selected
    if (selectedBattleIds.value.length === 0) {
      summary.value = [];
    }
  } catch (err) {
    error.value = "Failed to delete battle: " + err.message;
    console.log("Error deleting battle:", err);
  }
}

function isBattleSelected(battleId) {
  return selectedBattleIds.value.includes(battleId) || filterSelectedBattleIds.value.includes(battleId);
}

// Toggle battle selection
function toggleBattle(battleId, checked) {
  if (checked) {
    if (!selectedBattleIds.value.includes(battleId)) {
      selectedBattleIds.value.push(battleId);
    }
    const excludedIndex = excludedFilterBattleIds.value.indexOf(battleId);
    if (excludedIndex !== -1) {
      excludedFilterBattleIds.value.splice(excludedIndex, 1);
    }
  } else {
    const manualIndex = selectedBattleIds.value.indexOf(battleId);
    if (manualIndex !== -1) {
      selectedBattleIds.value.splice(manualIndex, 1);
    } else if (filteredBattleIds.value.includes(battleId)) {
      if (!excludedFilterBattleIds.value.includes(battleId)) {
        excludedFilterBattleIds.value.push(battleId);
      }
    }
  }
}

// Select/deselect all battles
function toggleAllBattles() {
  if (selectedBattleIds.value.length === battles.value.length) {
    selectedBattleIds.value = [];
  } else {
    selectedBattleIds.value = battles.value.map((b) => b.id);
  }
}

// Generate war summary
async function generateSummary() {
  if (!hasSelectedBattles.value) {
    return;
  }

  loadingSummary.value = true;
  error.value = "";
  try {
    const response = await getWarSummary(combinedBattleIds.value);
    if (response.success) {
      summary.value = response.data;
    }
  } catch (err) {
    error.value = "Failed to generate summary: " + err.message;
    console.log("Error generating summary:", err);
  } finally {
    loadingSummary.value = false;
  }
}

function clearCountryFilters() {
  countryFilters.value = [];
  excludedFilterBattleIds.value = [];
  countrySearch.value = "";
  filteredSummaryReset();
}

function clearExcludeCountryFilters() {
  excludeCountryFilters.value = [];
  excludeCountrySearch.value = "";
}

function clearAllFilters() {
  clearCountryFilters();
  clearExcludeCountryFilters();
}

function toggleCountryOption(option) {
  if (countryFilters.value.includes(option)) {
    countryFilters.value = countryFilters.value.filter((c) => c !== option);
  } else {
    countryFilters.value = [...countryFilters.value, option];
  }
}

function removeCountryChip(option, event) {
  event?.stopPropagation();
  countryFilters.value = countryFilters.value.filter((c) => c !== option);
}

function toggleExcludeCountryOption(option) {
  if (excludeCountryFilters.value.includes(option)) {
    excludeCountryFilters.value = excludeCountryFilters.value.filter((c) => c !== option);
  } else {
    excludeCountryFilters.value = [...excludeCountryFilters.value, option];
  }
}

function removeExcludeCountryChip(option, event) {
  event?.stopPropagation();
  excludeCountryFilters.value = excludeCountryFilters.value.filter((c) => c !== option);
}

function filteredSummaryReset() {
  // helper to reset summary when filters clear
  if (!selectedBattleIds.value.length) {
    summary.value = [];
  }
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
  if (includeDropdownOpen.value) {
    setDropdownPosition(includeTriggerRef, includeDropdownPosition);
  }
  if (excludeDropdownOpen.value) {
    setDropdownPosition(excludeTriggerRef, excludeDropdownPosition);
  }
}

function closeDropdowns(event) {
  const target = event?.target;
  const insideContainer = target?.closest?.(".multiselect-container");
  const insideDropdown =
    target?.closest?.("[data-dropdown-panel='country']") ||
    target?.closest?.("[data-dropdown-panel='country-exclude']");
  if (!insideContainer && !insideDropdown) {
    includeDropdownOpen.value = false;
    excludeDropdownOpen.value = false;
  }
}

function exportSummaryCsv() {
  if (!summary.value.length) {
    return;
  }

  const headers = ["Rank", "Player", "Side", "Total Damage", "Hits"];
  const rows = summary.value.map((player, index) => [
    index + 1,
    player.player_name || `Player #${player.fighter_id}`,
    player.side,
    player.total_damage,
    player.hit_count,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => {
          const stringValue = value ?? "";
          return `"${String(stringValue).replace(/"/g, '""')}"`;
        })
        .join(",")
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

watch(includeDropdownOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    setDropdownPosition(includeTriggerRef, includeDropdownPosition);
  }
});

watch(excludeDropdownOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    setDropdownPosition(excludeTriggerRef, excludeDropdownPosition);
  }
});

watch(
  userApiKey,
  (value) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(API_KEY_STORAGE_KEY, value.trim());
    }
  },
  { immediate: false }
);

// Load battles on mount
onMounted(() => {
  loadBattles();
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
  <div class="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30" @click="closeDropdowns">
    <!-- Top Header -->
    <header class="sticky top-0 z-40 w-full backdrop-blur-lg bg-slate-950/80 border-b border-slate-800/60">
      <div class="container mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <span class="text-xl">⚔️</span>
          </div>
          <div>
            <h1 class="font-bold text-lg tracking-tight text-white flex items-center gap-2">
              WAR <span class="text-slate-500 font-normal mx-1">|</span>
              <span class="text-emerald-400">Wars Summary for Eclesiar</span>
            </h1>
            <p class="text-xs text-slate-400">Battle Analytics & Damage Rankings</p>
          </div>
        </div>
        <div
          class="hidden md:flex items-center gap-2 text-xs font-mono text-emerald-300/80 bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-500/20"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
          ONLINE
        </div>
      </div>
    </header>

    <main class="container mx-auto px-4 py-8 space-y-6">
      <!-- Error message -->
      <div
        v-if="error"
        class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3"
      >
        <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <p>{{ error }}</p>
      </div>

      <!-- Fetch controls -->
      <section
        class="bg-slate-900/50 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-sm relative overflow-hidden"
      >
        <div
          class="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"
        ></div>

        <div class="flex flex-wrap gap-6 relative z-10">
          <!-- API key input -->
          <div class="relative group">
            <label
              class="absolute -top-2.5 left-3 px-1 bg-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-wider z-10"
              >Eclesiar API Key</label
            >
            <div class="flex items-center gap-2">
              <div class="relative">
                <svg
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 11c0-1.104.672-2 1.5-2s1.5.896 1.5 2v2h-3v-2zM7 9V7a5 5 0 0110 0v2h1a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h1z"
                  ></path>
                </svg>
                <input
                  v-model.trim="userApiKey"
                  type="password"
                  placeholder="Key is saved ONLY in your browser."
                  class="w-72 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none hover:bg-slate-900"
                />
              </div>
              <button
                type="button"
                class="px-3 py-1.5 text-xs text-slate-400 border border-slate-700 rounded-lg hover:text-white hover:border-emerald-500/40 transition-colors"
                @click="userApiKey = ''"
              >
                Clear
              </button>
            </div>
          </div>
          <!-- Single battle fetch -->
          <div class="relative group">
            <label
              class="absolute -top-2.5 left-3 px-1 bg-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-wider z-10"
              >Single Fetch</label
            >
            <div class="flex gap-2 items-center">
              <div class="relative">
                <svg
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors"
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
                  v-model="newBattleId"
                  type="number"
                  placeholder="Battle ID"
                  class="w-30 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none hover:bg-slate-900"
                  @keyup.enter="handleFetchBattle"
                />
              </div>
              <button
                @click="handleFetchBattle"
                :disabled="fetchingBattle || !newBattleId"
                class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-sm font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 shadow-lg shadow-emerald-500/20"
              >
                <span v-if="fetchingBattle">Fetching...</span>
                <span v-else>Fetch</span>
              </button>
            </div>
          </div>

          <!-- Range fetch -->
          <div class="relative group">
            <label
              class="absolute -top-2.5 left-3 px-1 bg-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-wider z-10"
              >Range Fetch</label
            >
            <div class="flex gap-2 items-center">
              <div class="relative">
                <svg
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  ></path>
                </svg>
                <input
                  v-model="rangeFromId"
                  type="number"
                  placeholder="From"
                  :disabled="fetchProgress?.isRunning"
                  class="w-32 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none hover:bg-slate-900 disabled:opacity-50"
                />
              </div>
              <span class="text-slate-600">→</span>
              <input
                v-model="rangeToId"
                type="number"
                placeholder="To"
                :disabled="fetchProgress?.isRunning"
                class="w-32 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none hover:bg-slate-900 disabled:opacity-50"
              />
              <button
                @click="handleFetchRange"
                :disabled="fetchProgress?.isRunning || !rangeFromId || !rangeToId"
                class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 hover:border-emerald-500/30"
              >
                Fetch Range
              </button>
            </div>
          </div>
        </div>

        <!-- Progress bar -->
        <div v-if="fetchProgress?.isRunning || fetchProgress?.total > 0" class="mt-4 pt-4 border-t border-slate-800">
          <div class="flex justify-between text-sm text-slate-400 mb-2">
            <span class="font-mono">Progress: {{ fetchProgress.current }} / {{ fetchProgress.total }}</span>
            <span>
              <span class="text-emerald-400 font-medium">{{ fetchProgress.completedCount }} OK</span>
              <span v-if="fetchProgress.failedCount > 0" class="text-red-400 ml-2"
                >{{ fetchProgress.failedCount }} failed</span
              >
            </span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              class="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              :style="{ width: `${(fetchProgress.current / fetchProgress.total) * 100}%` }"
            ></div>
          </div>
          <p v-if="!fetchProgress.isRunning" class="text-sm text-emerald-400 mt-2 font-medium">✓ Fetch completed!</p>
        </div>
      </section>

      <!-- Country Filters Section -->
      <section class="relative z-20 bg-slate-900/50 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-sm">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold text-white">Country Filters</h3>
            <p class="text-sm text-slate-500">Filter battles by attacker or defender country</p>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <span v-if="countryFilters.length || excludeCountryFilters.length" class="text-slate-400 font-mono">
              {{ filteredBattleIds.length }} battles matched
            </span>
            <button
              v-if="countryFilters.length || excludeCountryFilters.length"
              @click="clearAllFilters"
              class="px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Include countries multiselect -->
          <div class="multiselect-container relative">
            <label class="block text-sm font-medium text-emerald-400 mb-2">
              <span class="inline-flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Include countries
              </span>
            </label>

            <!-- Trigger button -->
            <button
              ref="includeTriggerRef"
              type="button"
              @click.stop="
                includeDropdownOpen = !includeDropdownOpen;
                excludeDropdownOpen = false;
              "
              class="w-full min-h-[44px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-left flex items-center gap-2 flex-wrap hover:border-emerald-500/50 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <template v-if="countryFilters.length">
                <span
                  v-for="country in countryFilters"
                  :key="country"
                  class="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 pl-2.5 pr-1.5 py-1 rounded-md text-sm border border-emerald-500/30"
                >
                  {{ country }}
                  <button
                    type="button"
                    class="ml-0.5 p-0.5 hover:bg-emerald-500/30 rounded transition-colors"
                    @click="removeCountryChip(country, $event)"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                </span>
              </template>
              <span v-else class="text-slate-500">Select countries to include...</span>
              <svg
                class="w-5 h-5 text-slate-500 ml-auto flex-shrink-0 transition-transform"
                :class="{ 'rotate-180': includeDropdownOpen }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            <!-- Dropdown -->
            <div
              v-show="includeDropdownOpen"
              class="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
            >
              <!-- Search -->
              <div class="p-2 border-b border-slate-800">
                <div class="relative">
                  <svg
                    class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
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
                    v-model="countrySearch"
                    type="text"
                    placeholder="Search countries..."
                    class="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    @click.stop
                  />
                  <button
                    v-if="countrySearch"
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded"
                    @click.stop="countrySearch = ''"
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
                <template v-if="filteredCountryOptions.length">
                  <button
                    v-for="country in filteredCountryOptions"
                    :key="country"
                    type="button"
                    class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-700/60 transition-colors"
                    :class="{ 'bg-green-500/10': countryFilters.includes(country) }"
                    @click.stop="toggleCountryOption(country)"
                  >
                    <span
                      class="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                      :class="countryFilters.includes(country) ? 'bg-green-500 border-green-500' : 'border-gray-500'"
                    >
                      <svg
                        v-if="countryFilters.includes(country)"
                        class="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </span>
                    <span class="text-sm text-gray-200">{{ country }}</span>
                  </button>
                </template>
                <div v-else class="px-3 py-6 text-center text-sm text-gray-500">
                  No countries match "{{ countrySearch }}"
                </div>
              </div>

              <!-- Footer -->
              <div v-if="countryFilters.length" class="p-2 border-t border-gray-700 bg-gray-800/80">
                <button
                  type="button"
                  class="w-full px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  @click.stop="clearCountryFilters"
                >
                  Clear selection ({{ countryFilters.length }})
                </button>
              </div>
            </div>
          </div>

          <!-- Exclude countries multiselect -->
          <div class="multiselect-container relative">
            <label class="block text-sm font-medium text-red-400 mb-2">
              <span class="inline-flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                Exclude countries
              </span>
            </label>

            <!-- Trigger button -->
            <button
              type="button"
              @click.stop="
                excludeDropdownOpen = !excludeDropdownOpen;
                includeDropdownOpen = false;
              "
              class="w-full min-h-[44px] px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-left flex items-center gap-2 flex-wrap hover:border-red-500/50 focus:outline-none focus:border-red-500 transition-colors"
            >
              <template v-if="excludeCountryFilters.length">
                <span
                  v-for="country in excludeCountryFilters"
                  :key="country"
                  class="inline-flex items-center gap-1 bg-red-500/20 text-red-300 pl-2.5 pr-1.5 py-1 rounded-md text-sm border border-red-500/30"
                >
                  {{ country }}
                  <button
                    type="button"
                    class="ml-0.5 p-0.5 hover:bg-red-500/30 rounded transition-colors"
                    @click="removeExcludeCountryChip(country, $event)"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                </span>
              </template>
              <span v-else class="text-gray-500">Select countries to exclude...</span>
              <svg
                class="w-5 h-5 text-gray-400 ml-auto flex-shrink-0 transition-transform"
                :class="{ 'rotate-180': excludeDropdownOpen }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            <!-- Dropdown -->
            <div
              v-show="excludeDropdownOpen"
              class="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden"
            >
              <!-- Search -->
              <div class="p-2 border-b border-gray-700">
                <div class="relative">
                  <svg
                    class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
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
                    v-model="excludeCountrySearch"
                    type="text"
                    placeholder="Search countries..."
                    class="w-full pl-9 pr-8 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                    @click.stop
                  />
                  <button
                    v-if="excludeCountrySearch"
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded"
                    @click.stop="excludeCountrySearch = ''"
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
                <template v-if="filteredExcludeCountryOptions.length">
                  <button
                    v-for="country in filteredExcludeCountryOptions"
                    :key="country"
                    type="button"
                    class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-700/60 transition-colors"
                    :class="{ 'bg-red-500/10': excludeCountryFilters.includes(country) }"
                    @click.stop="toggleExcludeCountryOption(country)"
                  >
                    <span
                      class="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                      :class="excludeCountryFilters.includes(country) ? 'bg-red-500 border-red-500' : 'border-gray-500'"
                    >
                      <svg
                        v-if="excludeCountryFilters.includes(country)"
                        class="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="3"
                          d="M6 18L18 6M6 6l12 12"
                        ></path>
                      </svg>
                    </span>
                    <span class="text-sm text-gray-200">{{ country }}</span>
                  </button>
                </template>
                <div v-else class="px-3 py-6 text-center text-sm text-gray-500">
                  No countries match "{{ excludeCountrySearch }}"
                </div>
              </div>

              <!-- Footer -->
              <div v-if="excludeCountryFilters.length" class="p-2 border-t border-gray-700 bg-gray-800/80">
                <button
                  type="button"
                  class="w-full px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  @click.stop="clearExcludeCountryFilters"
                >
                  Clear selection ({{ excludeCountryFilters.length }})
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="relative grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                @click="toggleAllBattles"
                class="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
              >
                {{ selectedBattleIds.length === battles.length ? "Deselect All" : "Select All" }}
              </button>
              <button
                @click="generateSummary"
                :disabled="!hasSelectedBattles || loadingSummary"
                class="px-4 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <span v-if="loadingSummary">Loading...</span>
                <span v-else>Generate Summary ({{ combinedBattleIds.length }})</span>
              </button>
            </div>
          </div>

          <div v-if="countryFilters.length || excludeCountryFilters.length" class="mb-4 text-sm text-slate-400">
            Showing {{ displayedBattles.length }} of {{ battles.length }} battles (filtered)
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
          <div v-else-if="battles.length === 0" class="text-center py-12 text-slate-500">
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
                  <th class="px-4 py-3 text-left">Select</th>
                  <th class="px-4 py-3 text-left">ID</th>
                  <th class="px-4 py-3 text-left">Attacker</th>
                  <th class="px-4 py-3 text-left">Defender</th>
                  <th class="px-4 py-3 text-left">Region</th>
                  <th class="px-4 py-3 text-left">Rounds</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                <tr
                  v-for="battle in displayedBattles"
                  :key="battle.id"
                  class="hover:bg-slate-800/30 transition-colors group"
                >
                  <td class="px-4 py-3">
                    <input
                      type="checkbox"
                      :checked="isBattleSelected(battle.id)"
                      @change="toggleBattle(battle.id, $event.target.checked)"
                      class="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0"
                    />
                  </td>
                  <td class="px-4 py-3 font-mono text-slate-500">{{ battle.id }}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <img
                        v-if="battle.attacker_avatar"
                        :src="battle.attacker_avatar"
                        class="w-6 h-6 rounded border border-slate-700"
                        :alt="battle.attacker_name"
                      />
                      <span class="text-slate-200 group-hover:text-white transition-colors">{{
                        battle.attacker_name
                      }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <img
                        v-if="battle.defender_avatar"
                        :src="battle.defender_avatar"
                        class="w-6 h-6 rounded border border-slate-700"
                        :alt="battle.defender_name"
                      />
                      <span class="text-slate-200 group-hover:text-white transition-colors">{{
                        battle.defender_name
                      }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-slate-300">{{ battle.region_name || "Unknown" }}</div>
                    <div class="text-xs text-slate-600 font-mono">ID: {{ battle.region_id || "-" }}</div>
                  </td>
                  <td class="px-4 py-3 font-mono text-slate-400">{{ battle.rounds_count }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="hasSelectedBattles" class="mt-4 pt-4 border-t border-slate-800 text-sm text-slate-500">
            <span class="font-mono">Manual: {{ selectedBattleIds.length }}</span>
            <span class="mx-2 text-slate-700">|</span>
            <span class="font-mono">Filters: {{ filterSelectedBattleIds.length }}</span>
            <span class="mx-2 text-slate-700">|</span>
            <span class="font-mono text-emerald-400">Total: {{ combinedBattleIds.length }}</span>
          </div>
        </div>

        <!-- Summary panel -->
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
              <span v-if="summary.length" class="text-sm text-slate-400 font-mono">{{ summary.length }} players</span>
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
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-slate-900 text-slate-400 font-medium uppercase text-xs tracking-wider z-10">
                <tr>
                  <th class="px-4 py-3 text-left">#</th>
                  <th class="px-4 py-3 text-left">Player</th>
                  <th class="px-4 py-3 text-left">Side</th>
                  <th class="px-4 py-3 text-right">Total Damage</th>
                  <th class="px-4 py-3 text-right">Hits</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                <tr
                  v-for="(player, index) in summary"
                  :key="`${player.fighter_id}-${player.side}`"
                  class="hover:bg-slate-800/30 transition-colors group"
                >
                  <td class="px-4 py-3 font-mono text-slate-600">{{ index + 1 }}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
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
                      <span class="text-slate-200 group-hover:text-white transition-colors">{{
                        player.player_name || `Player #${player.fighter_id}`
                      }}</span>
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
                  <td class="px-4 py-3 text-right font-mono text-emerald-400 font-medium">
                    {{ formatNumber(player.total_damage) }}
                  </td>
                  <td class="px-4 py-3 text-right font-mono text-slate-500">
                    {{ formatNumber(player.hit_count) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <footer class="border-t border-slate-900 bg-slate-950 py-8 mt-auto">
      <div class="container mx-auto px-4 text-center">
        <p class="text-slate-400 text-sm">
          &copy; 2025 WAR - WARs Summary for Eclesiar ||
          <span class="text-xs text-slate-400 mt-2 inline-block">
            Made with <span class="text-red-500">❤️</span> by
            <a
              href="https://github.com/p0tfur"
              target="_blank"
              class="text-emerald-500/80 hover:text-emerald-500 transition-colors"
              >p0tfur</a
            >
          </span>
          <br />
          <a
            href="https://24na7.info/eclesiar-scripts/"
            target="_blank"
            class="text-emerald-500/80 hover:text-emerald-500 transition-colors"
            >Tampermonkey Scripts for Eclesiar</a
          >
          |
          <a
            href="https://handytoolbox-front.pages.dev/eclesiar/tools/eclesiar-dmg"
            target="_blank"
            class="text-emerald-500/80 hover:text-emerald-500 transition-colors"
            >Damage Calculator for Eclesiar</a
          >
          |
          <a
            href="https://lifedots.app/"
            target="_blank"
            class="text-emerald-500/80 hover:text-emerald-500 transition-colors"
            >Visualize Your Life Timeline
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #0f172a;
}
::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
