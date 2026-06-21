<script setup>
const props = defineProps({
  recentFronts: {
    type: Array,
    required: true,
  },
  formatShortDate: {
    type: Function,
    required: true,
  },
});
</script>

<template>
  <div class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5 md:p-6">
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Front log</p>
        <h3 class="mt-2 text-2xl font-bold text-white">Recent war fronts</h3>
      </div>
    </div>

    <div class="mt-5 space-y-3">
      <div v-for="battle in props.recentFronts" :key="battle.id" class="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-semibold text-white">#{{ battle.id }}</div>
          <div class="text-xs uppercase tracking-[0.16em] text-slate-500">{{ props.formatShortDate(battle.end_date) }}</div>
        </div>
        <div class="mt-3 flex items-center justify-between gap-3 text-sm">
          <div class="min-w-0">
            <div class="font-semibold text-emerald-200">
              {{ battle.attacker?.flag || "•" }} {{ battle.attacker_name }}
            </div>
            <div class="text-xs text-slate-500">Attacker</div>
          </div>
          <div class="text-lg font-black text-slate-500">{{ battle.attackers_score }} : {{ battle.defenders_score }}</div>
          <div class="min-w-0 text-right">
            <div class="font-semibold text-rose-200">
              {{ battle.defender?.flag || "•" }} {{ battle.defender_name }}
            </div>
            <div class="text-xs text-slate-500">Defender</div>
          </div>
        </div>
        <div class="mt-3 text-xs text-slate-500">{{ battle.region_name || "Unknown region" }}</div>
      </div>
    </div>
  </div>
</template>
