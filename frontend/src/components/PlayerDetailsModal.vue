<script setup>
import { computed } from "vue";

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  player: {
    type: Object,
    default: null,
  },
  details: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    required: true,
  },
  error: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close"]);

const playerName = computed(() => props.player?.player_name || `Player #${props.player?.fighter_id ?? ""}`);
const profileUrl = computed(() =>
  props.player?.fighter_id ? `https://eclesiar.com/user/${props.player.fighter_id}` : "#",
);

function formatNumber(num) {
  return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") || "0";
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')"></div>
      <div
        class="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 class="text-lg font-semibold text-white">Szczegóły gracza</h3>
            <p class="text-sm text-slate-400">{{ playerName }}</p>
          </div>
          <button type="button" class="text-slate-400 hover:text-white transition-colors" @click="emit('close')">
            ✕
          </button>
        </div>

        <div class="px-6 py-4 space-y-4 overflow-y-auto min-h-0">
          <div class="flex flex-wrap items-center gap-3">
            <a
              v-if="player?.fighter_id"
              :href="profileUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 hover:border-emerald-500/30 transition-colors"
            >
              Otwórz profil w grze
            </a>
            <span v-if="details.length" class="text-xs text-slate-500 font-mono">
              {{ details.length }} bitew w podsumowaniu
            </span>
          </div>

          <div v-if="loading" class="text-center py-10 text-slate-500">Ładowanie szczegółów...</div>
          <div v-else-if="error" class="text-sm text-red-400">{{ error }}</div>
          <div v-else-if="details.length === 0" class="text-center py-10 text-slate-500">
            Brak danych dla wybranych bitew.
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-950/50 text-slate-400 font-medium uppercase text-xs tracking-wider">
                <tr>
                  <th class="px-2 py-3 text-left">Battle ID</th>
                  <th class="px-3 py-3 text-left">Strony</th>
                  <th class="px-3 py-3 text-left">Region</th>
                  <th class="px-3 py-3 text-left">Data</th>
                  <th class="px-3 py-3 text-right">DMG przed zwycięstwem</th>
                  <th class="px-3 py-3 text-right">DMG po zwycięstwie</th>
                  <th class="px-3 py-3 text-right">BH</th>
                  <th class="px-3 py-3 text-right">Hits</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                <tr v-for="row in details" :key="row.battle_id" class="hover:bg-slate-800/30">
                  <td class="px-2 py-2 font-mono text-slate-300">{{ row.battle_id }}</td>
                  <td class="px-3 py-2 text-slate-300">{{ row.attacker_name }} vs {{ row.defender_name }}</td>
                  <td class="px-3 py-2 text-slate-400">{{ row.region_name || "-" }}</td>
                  <td class="px-3 py-2 text-slate-500">
                    {{ row.end_date ? new Date(row.end_date).toLocaleDateString("pl-PL") : "-" }}
                  </td>
                  <td class="px-3 py-2 text-right font-mono text-emerald-400">
                    {{ formatNumber(row.damage_before_victory ?? 0) }}
                  </td>
                  <td class="px-3 py-2 text-right font-mono text-lime-300">
                    {{ formatNumber(row.damage_after_victory ?? 0) }}
                  </td>
                  <td class="px-3 py-2 text-right font-mono text-amber-300">
                    {{ formatNumber(row.bh_count) }}
                  </td>
                  <td class="px-3 py-2 text-right font-mono text-slate-400">
                    {{ formatNumber(row.hit_count) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            class="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 hover:border-emerald-500/30 transition-colors"
            @click="emit('close')"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
