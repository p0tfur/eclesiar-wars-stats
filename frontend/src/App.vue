<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import {
  getBattles,
  fetchBattle,
  fetchCurrentRound,
  fetchBattleRange,
  getFetchProgress,
  getWarSummary,
  getPlayerBattleDetails,
  deleteBattle,
} from "./api.js";
import FetchControls from "./components/FetchControls.vue";
import FiltersSection from "./components/FiltersSection.vue";
import BattlesTable from "./components/BattlesTable.vue";
import SummaryPanel from "./components/SummaryPanel.vue";
import PlayerDetailsModal from "./components/PlayerDetailsModal.vue";
import PassifistsVsBakersDashboard from "./components/PassifistsVsBakersDashboard.vue";
import { PASSIFISTS_VS_BAKERS_ROUTE } from "./constants/passifistsVsBakers.js";

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

const rangeFromId = ref("");
const rangeToId = ref("");
const fetchProgress = ref(null);
let progressInterval = null;

const countryFilters = ref([]);
const excludedFilterBattleIds = ref([]);
const countrySearch = ref("");
const includeDropdownOpen = ref(false);

const excludeCountryFilters = ref([]);
const excludeCountrySearch = ref("");
const excludeDropdownOpen = ref(false);

const dateFrom = ref("");
const dateTo = ref("");

const refreshingBattleId = ref(null);
const playerDetailsOpen = ref(false);
const selectedPlayer = ref(null);
const playerDetails = ref([]);
const playerDetailsLoading = ref(false);
const playerDetailsError = ref("");
const currentView = ref(
  typeof window !== "undefined" && window.location.hash === `#${PASSIFISTS_VS_BAKERS_ROUTE}`
    ? PASSIFISTS_VS_BAKERS_ROUTE
    : "default",
);

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

const hasActiveFilters = computed(() => {
  return countryFilters.value.length > 0 || excludeCountryFilters.value.length > 0 || dateFrom.value || dateTo.value;
});

const filteredBattleIds = computed(() => {
  let result = battles.value;

  if (countryFilters.value.length) {
    result = result.filter(
      (battle) =>
        countryFilters.value.includes(battle.attacker_name) || countryFilters.value.includes(battle.defender_name),
    );
  }

  if (excludeCountryFilters.value.length) {
    result = result.filter(
      (battle) =>
        !excludeCountryFilters.value.includes(battle.attacker_name) &&
        !excludeCountryFilters.value.includes(battle.defender_name),
    );
  }

  if (dateFrom.value) {
    const fromDate = new Date(dateFrom.value);
    fromDate.setHours(0, 0, 0, 0);
    result = result.filter((battle) => {
      if (!battle.end_date) return false;
      const battleDate = new Date(battle.end_date);
      return battleDate >= fromDate;
    });
  }

  if (dateTo.value) {
    const toDate = new Date(dateTo.value);
    toDate.setHours(23, 59, 59, 999);
    result = result.filter((battle) => {
      if (!battle.end_date) return false;
      const battleDate = new Date(battle.end_date);
      return battleDate <= toDate;
    });
  }

  if (!hasActiveFilters.value) {
    return [];
  }

  return result.map((battle) => battle.id);
});

const displayedBattles = computed(() => {
  if (!hasActiveFilters.value) {
    return battles.value;
  }
  const allowed = new Set(filteredBattleIds.value);
  return battles.value.filter((battle) => allowed.has(battle.id));
});

const sortedDisplayedBattles = computed(() => {
  return [...displayedBattles.value].sort((a, b) => (Number(b.id) || 0) - Number(a.id || 0));
});

const filterSelectedBattleIds = computed(() =>
  filteredBattleIds.value.filter((id) => !excludedFilterBattleIds.value.includes(id)),
);

const combinedBattleIds = computed(() => {
  const combined = new Set(selectedBattleIds.value);
  filterSelectedBattleIds.value.forEach((id) => combined.add(id));
  return Array.from(combined);
});

const hasSelectedBattles = computed(() => combinedBattleIds.value.length > 0);

function syncViewFromHash() {
  if (typeof window === "undefined") {
    return;
  }

  currentView.value =
    window.location.hash === `#${PASSIFISTS_VS_BAKERS_ROUTE}` ? PASSIFISTS_VS_BAKERS_ROUTE : "default";
}

function openPassifistsDashboard() {
  if (typeof window !== "undefined") {
    window.location.hash = PASSIFISTS_VS_BAKERS_ROUTE;
  }
  currentView.value = PASSIFISTS_VS_BAKERS_ROUTE;
}

function openDefaultView() {
  if (typeof window !== "undefined") {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  currentView.value = "default";
}

function isBattleIncomplete(battle) {
  const attackerWins = battle.attackers_score || 0;
  const defenderWins = battle.defenders_score || 0;
  return attackerWins < 5 && defenderWins < 5;
}

async function refreshBattle(battleId) {
  if (refreshingBattleId.value) return;

  refreshingBattleId.value = battleId;
  error.value = "";

  try {
    const battle = battles.value.find((entry) => Number(entry.id) === Number(battleId));

    if (battle && isBattleIncomplete(battle)) {
      await fetchCurrentRound(battleId, userApiKey.value || undefined);
    } else {
      await fetchBattle(battleId, userApiKey.value || undefined);
    }

    await loadBattles();
  } catch (err) {
    error.value = "Failed to refresh battle: " + err.message;
  } finally {
    refreshingBattleId.value = null;
  }
}

watch(filteredBattleIds, (newIds) => {
  excludedFilterBattleIds.value = excludedFilterBattleIds.value.filter((id) => newIds.includes(id));
});

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
  } finally {
    loading.value = false;
  }
}

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
  } finally {
    fetchingBattle.value = false;
  }
}

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
      startProgressPolling();
    }
  } catch (err) {
    error.value = "Failed to start range fetch: " + err.message;
  }
}

function startProgressPolling() {
  if (progressInterval) clearInterval(progressInterval);

  progressInterval = setInterval(async () => {
    try {
      const response = await getFetchProgress();
      if (response.success) {
        fetchProgress.value = response.data;

        if (!response.data.isRunning) {
          clearInterval(progressInterval);
          progressInterval = null;
          rangeFromId.value = "";
          rangeToId.value = "";
          await loadBattles();
        }
      }
    } catch {
      return;
    }
  }, 1000);
}

async function handleDeleteBattle(battleId) {
  if (!confirm("Are you sure you want to delete this battle?")) return;

  try {
    await deleteBattle(battleId);
    selectedBattleIds.value = selectedBattleIds.value.filter((id) => id !== battleId);
    await loadBattles();
    if (selectedBattleIds.value.length === 0) {
      summary.value = [];
    }
  } catch (err) {
    error.value = "Failed to delete battle: " + err.message;
  }
}

function isBattleSelected(battleId) {
  return selectedBattleIds.value.includes(battleId) || filterSelectedBattleIds.value.includes(battleId);
}

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
    } else if (filteredBattleIds.value.includes(battleId) && !excludedFilterBattleIds.value.includes(battleId)) {
      excludedFilterBattleIds.value.push(battleId);
    }
  }
}

function toggleAllBattles() {
  if (selectedBattleIds.value.length === battles.value.length) {
    selectedBattleIds.value = [];
  } else {
    selectedBattleIds.value = battles.value.map((battle) => battle.id);
  }
}

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
  } finally {
    loadingSummary.value = false;
  }
}

async function openPlayerDetails(payload) {
  const player = payload?.player || payload;
  const battleIds = payload?.battleIds || combinedBattleIds.value;

  if (!player?.fighter_id || !battleIds?.length) {
    return;
  }

  selectedPlayer.value = player;
  playerDetailsOpen.value = true;
  playerDetailsLoading.value = true;
  playerDetailsError.value = "";
  playerDetails.value = [];

  try {
    const response = await getPlayerBattleDetails(battleIds, player.fighter_id);
    if (response.success) {
      playerDetails.value = response.data;
    } else {
      playerDetailsError.value = response.error || "Failed to load player details.";
    }
  } catch (err) {
    playerDetailsError.value = "Failed to load player details: " + err.message;
  } finally {
    playerDetailsLoading.value = false;
  }
}

function closePlayerDetails() {
  playerDetailsOpen.value = false;
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

function clearDateFilters() {
  dateFrom.value = "";
  dateTo.value = "";
}

function clearAllFilters() {
  clearCountryFilters();
  clearExcludeCountryFilters();
  clearDateFilters();
}

function toggleCountryOption(option) {
  if (countryFilters.value.includes(option)) {
    countryFilters.value = countryFilters.value.filter((country) => country !== option);
  } else {
    countryFilters.value = [...countryFilters.value, option];
  }
}

function removeCountryChip(option, event) {
  event?.stopPropagation();
  countryFilters.value = countryFilters.value.filter((country) => country !== option);
}

function toggleExcludeCountryOption(option) {
  if (excludeCountryFilters.value.includes(option)) {
    excludeCountryFilters.value = excludeCountryFilters.value.filter((country) => country !== option);
  } else {
    excludeCountryFilters.value = [...excludeCountryFilters.value, option];
  }
}

function removeExcludeCountryChip(option, event) {
  event?.stopPropagation();
  excludeCountryFilters.value = excludeCountryFilters.value.filter((country) => country !== option);
}

function filteredSummaryReset() {
  if (!selectedBattleIds.value.length) {
    summary.value = [];
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

watch(
  userApiKey,
  (value) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(API_KEY_STORAGE_KEY, value.trim());
    }
  },
  { immediate: false },
);

onMounted(() => {
  loadBattles();
  document.addEventListener("click", closeDropdowns);
  window.addEventListener("hashchange", syncViewFromHash);
  syncViewFromHash();
});

onUnmounted(() => {
  document.removeEventListener("click", closeDropdowns);
  window.removeEventListener("hashchange", syncViewFromHash);
});
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30" @click="closeDropdowns">
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

      <FetchControls
        :user-api-key="userApiKey"
        :new-battle-id="newBattleId"
        :range-from-id="rangeFromId"
        :range-to-id="rangeToId"
        :fetching-battle="fetchingBattle"
        :fetch-progress="fetchProgress"
        @update:user-api-key="userApiKey = $event"
        @update:new-battle-id="newBattleId = $event"
        @update:range-from-id="rangeFromId = $event"
        @update:range-to-id="rangeToId = $event"
        @fetch-battle="handleFetchBattle"
        @fetch-range="handleFetchRange"
        @clear-api-key="userApiKey = ''"
      />

      <FiltersSection
        :current-view="currentView"
        :has-selected-battles="hasSelectedBattles"
        :selected-battle-count="selectedBattleIds.length"
        :filter-selected-battle-count="filterSelectedBattleIds.length"
        :combined-battle-count="combinedBattleIds.length"
        :has-active-filters="hasActiveFilters"
        :filtered-battle-ids-count="filteredBattleIds.length"
        :date-from="dateFrom"
        :date-to="dateTo"
        :country-filters="countryFilters"
        :exclude-country-filters="excludeCountryFilters"
        :country-search="countrySearch"
        :exclude-country-search="excludeCountrySearch"
        :include-dropdown-open="includeDropdownOpen"
        :exclude-dropdown-open="excludeDropdownOpen"
        :filtered-country-options="filteredCountryOptions"
        :filtered-exclude-country-options="filteredExcludeCountryOptions"
        @update:date-from="dateFrom = $event"
        @update:date-to="dateTo = $event"
        @update:country-search="countrySearch = $event"
        @update:exclude-country-search="excludeCountrySearch = $event"
        @update:include-dropdown-open="includeDropdownOpen = $event"
        @update:exclude-dropdown-open="excludeDropdownOpen = $event"
        @clear-all-filters="clearAllFilters"
        @clear-country-filters="clearCountryFilters"
        @clear-exclude-country-filters="clearExcludeCountryFilters"
        @toggle-country-option="toggleCountryOption"
        @toggle-exclude-country-option="toggleExcludeCountryOption"
        @remove-country-chip="removeCountryChip"
        @remove-exclude-country-chip="removeExcludeCountryChip"
        @open-passifists-dashboard="openPassifistsDashboard"
      />

      <PassifistsVsBakersDashboard
        v-if="currentView === PASSIFISTS_VS_BAKERS_ROUTE"
        :battles="battles"
        :loading-battles="loading"
        @back="openDefaultView"
        @open-player-details="openPlayerDetails"
      />

      <div v-else class="relative grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BattlesTable
          :loading="loading"
          :sorted-displayed-battles="sortedDisplayedBattles"
          :battles-count="battles.length"
          :displayed-battles-count="displayedBattles.length"
          :country-filters-count="countryFilters.length"
          :exclude-country-filters-count="excludeCountryFilters.length"
          :selected-battle-count="selectedBattleIds.length"
          :has-selected-battles="hasSelectedBattles"
          :combined-battle-count="combinedBattleIds.length"
          :loading-summary="loadingSummary"
          :refreshing-battle-id="refreshingBattleId"
          :is-battle-incomplete="isBattleIncomplete"
          :is-battle-selected="isBattleSelected"
          @toggle-all-battles="toggleAllBattles"
          @generate-summary="generateSummary"
          @toggle-battle="toggleBattle"
          @refresh-battle="refreshBattle"
        />
        <SummaryPanel :summary="summary" @open-player-details="openPlayerDetails" />
      </div>

      <PlayerDetailsModal
        :is-open="playerDetailsOpen"
        :player="selectedPlayer"
        :details="playerDetails"
        :loading="playerDetailsLoading"
        :error="playerDetailsError"
        @close="closePlayerDetails"
      />
    </main>

    <footer class="border-t border-slate-900 bg-slate-950 py-8 mt-auto">
      <div class="container mx-auto px-4 text-center">
        <p class="text-slate-400 text-sm">
          &copy; 2025 WAR - WARs Summary for Eclesiar ||
          <span class="text-xs text-slate-400 mt-2 inline-block">
            Made with <span class="text-red-500">❤</span> by
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
