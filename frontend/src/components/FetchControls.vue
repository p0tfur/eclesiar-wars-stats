<script setup>
const props = defineProps({
  userApiKey: {
    type: String,
    required: true,
  },
  newBattleId: {
    type: String,
    required: true,
  },
  rangeFromId: {
    type: String,
    required: true,
  },
  rangeToId: {
    type: String,
    required: true,
  },
  fetchingBattle: {
    type: Boolean,
    required: true,
  },
  fetchProgress: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits([
  "update:user-api-key",
  "update:new-battle-id",
  "update:range-from-id",
  "update:range-to-id",
  "fetch-battle",
  "fetch-range",
  "clear-api-key",
]);
</script>

<template>
  <!-- Fetch controls -->
  <section
    class="bg-slate-900/50 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-sm relative overflow-hidden"
  >
    <div class="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

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
              :value="userApiKey"
              type="password"
              placeholder="Key is saved ONLY in your browser."
              class="w-72 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none hover:bg-slate-900"
              @input="emit('update:user-api-key', $event.target.value)"
            />
          </div>
          <button
            type="button"
            class="px-3 py-1.5 text-xs text-slate-400 border border-slate-700 rounded-lg hover:text-white hover:border-emerald-500/40 transition-colors"
            @click="emit('clear-api-key')"
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
              :value="newBattleId"
              type="number"
              placeholder="Battle ID"
              class="w-30 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none hover:bg-slate-900"
              @keyup.enter="emit('fetch-battle')"
              @input="emit('update:new-battle-id', $event.target.value)"
            />
          </div>
          <button
            :disabled="fetchingBattle || !newBattleId"
            class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-sm font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 shadow-lg shadow-emerald-500/20"
            @click="emit('fetch-battle')"
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
              :value="rangeFromId"
              type="number"
              placeholder="From"
              :disabled="fetchProgress?.isRunning"
              class="w-32 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none hover:bg-slate-900 disabled:opacity-50"
              @input="emit('update:range-from-id', $event.target.value)"
            />
          </div>
          <span class="text-slate-600">→</span>
          <input
            :value="rangeToId"
            type="number"
            placeholder="To"
            :disabled="fetchProgress?.isRunning"
            class="w-32 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none hover:bg-slate-900 disabled:opacity-50"
            @input="emit('update:range-to-id', $event.target.value)"
          />
          <button
            :disabled="fetchProgress?.isRunning || !rangeFromId || !rangeToId"
            class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 hover:border-emerald-500/30"
            @click="emit('fetch-range')"
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
</template>
