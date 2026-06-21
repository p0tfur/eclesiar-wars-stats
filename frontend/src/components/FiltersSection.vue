<script setup>
const props = defineProps({
  hasSelectedBattles: {
    type: Boolean,
    required: true,
  },
  selectedBattleCount: {
    type: Number,
    required: true,
  },
  filterSelectedBattleCount: {
    type: Number,
    required: true,
  },
  combinedBattleCount: {
    type: Number,
    required: true,
  },
  hasActiveFilters: {
    type: Boolean,
    required: true,
  },
  filteredBattleIdsCount: {
    type: Number,
    required: true,
  },
  dateFrom: {
    type: String,
    required: true,
  },
  dateTo: {
    type: String,
    required: true,
  },
  countryFilters: {
    type: Array,
    required: true,
  },
  excludeCountryFilters: {
    type: Array,
    required: true,
  },
  countrySearch: {
    type: String,
    required: true,
  },
  excludeCountrySearch: {
    type: String,
    required: true,
  },
  includeDropdownOpen: {
    type: Boolean,
    required: true,
  },
  excludeDropdownOpen: {
    type: Boolean,
    required: true,
  },
  filteredCountryOptions: {
    type: Array,
    required: true,
  },
  filteredExcludeCountryOptions: {
    type: Array,
    required: true,
  },
  currentView: {
    type: String,
    required: true,
  },
});

const emit = defineEmits([
  "update:dateFrom",
  "update:dateTo",
  "update:countrySearch",
  "update:excludeCountrySearch",
  "update:includeDropdownOpen",
  "update:excludeDropdownOpen",
  "clear-all-filters",
  "clear-country-filters",
  "clear-exclude-country-filters",
  "toggle-country-option",
  "toggle-exclude-country-option",
  "remove-country-chip",
  "remove-exclude-country-chip",
  "open-passifists-dashboard",
]);
</script>

<template>
  <!-- Filters Section -->
  <section class="relative z-20 bg-slate-900/50 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-sm">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-4">
        <h3 class="text-lg font-semibold text-white">Filters</h3>
        <!-- Selection stats -->
        <div v-if="hasSelectedBattles" class="flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span>Manual: {{ selectedBattleCount }}</span>
          <span class="text-slate-700">|</span>
          <span>Filters: {{ filterSelectedBattleCount }}</span>
          <span class="text-slate-700">|</span>
          <span class="text-emerald-400">Total: {{ combinedBattleCount }}</span>
        </div>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <span v-if="hasActiveFilters" class="text-slate-400 font-mono text-xs">
          {{ filteredBattleIdsCount }} matched
        </span>
        <button
          v-if="hasActiveFilters"
          class="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded border border-slate-700 transition-colors"
          @click="emit('clear-all-filters')"
        >
          Clear all
        </button>
      </div>
    </div>

    <button
      type="button"
      class="group mb-4 w-full overflow-hidden rounded-2xl border text-left transition-all duration-300"
      :class="
        currentView === 'passifists-vs-bakers'
          ? 'border-emerald-400/40 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.92),rgba(244,63,94,0.16))] shadow-[0_18px_50px_rgba(16,185,129,0.12)]'
          : 'border-slate-800 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(15,23,42,0.92),rgba(244,63,94,0.10))] hover:border-emerald-400/30 hover:shadow-[0_18px_50px_rgba(16,185,129,0.10)]'
      "
      @click="emit('open-passifists-dashboard')"
    >
      <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div class="max-w-2xl">
          <div class="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-200">
            Featured Campaign
          </div>
          <h4 class="mt-3 text-xl font-black tracking-tight text-white">Passifists vs The Bakers</h4>
          <p class="mt-2 text-sm leading-6 text-slate-300">
            Open the dedicated war dashboard with campaign-only stats, bloc comparisons, country breakdowns and top player performance since 05.06.2026.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-right">
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Campaign scope</div>
            <div class="mt-2 text-sm font-semibold text-white">Passifists / APP / URL vs Bakers</div>
          </div>
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-200 transition-transform duration-300 group-hover:translate-x-1">
            →
          </div>
        </div>
      </div>
    </button>

    <!-- All filters in one row -->
    <div class="flex flex-wrap items-end gap-4">
      <!-- Date Range Filter -->
      <div class="flex-shrink-0 min-w-[260px]">
        <label class="block text-sm font-medium text-amber-400 mb-2">Date Range</label>
        <div class="flex items-center gap-3">
          <input
            :value="dateFrom"
            type="date"
            class="w-40 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all outline-none hover:bg-slate-900"
            @input="emit('update:dateFrom', $event.target.value)"
          />
          <span class="text-slate-600 text-sm">→</span>
          <input
            :value="dateTo"
            type="date"
            class="w-40 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all outline-none hover:bg-slate-900"
            @input="emit('update:dateTo', $event.target.value)"
          />
        </div>
      </div>

      <!-- Include countries multiselect -->
      <div class="multiselect-container relative flex-1 min-w-[260px]">
        <label class="block text-sm font-medium text-emerald-400 mb-2">Include</label>

        <!-- Trigger button -->
        <button
          type="button"
          class="w-full min-h-[44px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-left flex items-center gap-2 flex-wrap hover:border-emerald-500/50 focus:outline-none focus:border-emerald-500 transition-colors"
          @click.stop="
            emit('update:includeDropdownOpen', !includeDropdownOpen);
            emit('update:excludeDropdownOpen', false);
          "
        >
          <template v-if="countryFilters.length">
            <span
              v-for="country in countryFilters"
              :key="country"
              class="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-200 pl-2 pr-1.5 py-0.5 rounded text-sm border border-emerald-500/30"
            >
              {{ country }}
              <button
                type="button"
                class="p-0.5 hover:bg-emerald-500/30 rounded transition-colors"
                @click="emit('remove-country-chip', country, $event)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </span>
          </template>
          <span v-else class="text-slate-500 text-sm">Select countries...</span>
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
                :value="countrySearch"
                type="text"
                placeholder="Search countries..."
                class="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                @click.stop
                @input="emit('update:countrySearch', $event.target.value)"
              />
              <button
                v-if="countrySearch"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded"
                @click.stop="emit('update:countrySearch', '')"
                type="button"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
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
                @click.stop="emit('toggle-country-option', country)"
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
              @click.stop="emit('clear-country-filters')"
            >
              Clear selection ({{ countryFilters.length }})
            </button>
          </div>
        </div>
      </div>

      <!-- Exclude countries multiselect -->
      <div class="multiselect-container relative flex-1 min-w-[260px]">
        <label class="block text-sm font-medium text-red-400 mb-2">Exclude</label>

        <!-- Trigger button -->
        <button
          type="button"
          class="w-full min-h-[44px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-left flex items-center gap-2 flex-wrap hover:border-red-500/50 focus:outline-none focus:border-red-500 transition-colors"
          @click.stop="
            emit('update:excludeDropdownOpen', !excludeDropdownOpen);
            emit('update:includeDropdownOpen', false);
          "
        >
          <template v-if="excludeCountryFilters.length">
            <span
              v-for="country in excludeCountryFilters"
              :key="country"
              class="inline-flex items-center gap-1 bg-red-500/20 text-red-200 pl-2 pr-1.5 py-0.5 rounded text-sm border border-red-500/30"
            >
              {{ country }}
              <button
                type="button"
                class="p-0.5 hover:bg-red-500/30 rounded transition-colors"
                @click="emit('remove-exclude-country-chip', country, $event)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </span>
          </template>
          <span v-else class="text-slate-500 text-sm">Select countries...</span>
          <svg
            class="w-5 h-5 text-slate-500 ml-auto flex-shrink-0 transition-transform"
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
                :value="excludeCountrySearch"
                type="text"
                placeholder="Search countries..."
                class="w-full pl-9 pr-8 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                @click.stop
                @input="emit('update:excludeCountrySearch', $event.target.value)"
              />
              <button
                v-if="excludeCountrySearch"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded"
                @click.stop="emit('update:excludeCountrySearch', '')"
                type="button"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
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
                @click.stop="emit('toggle-exclude-country-option', country)"
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
              @click.stop="emit('clear-exclude-country-filters')"
            >
              Clear selection ({{ excludeCountryFilters.length }})
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
