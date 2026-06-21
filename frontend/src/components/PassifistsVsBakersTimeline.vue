<script setup>
const props = defineProps({
  dailyTimeline: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div class="rounded-[26px] border border-slate-800 bg-slate-900/65 p-5 md:p-6 xl:col-span-2">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Timeline</p>
        <h3 class="mt-2 text-2xl font-bold text-white">Day-by-day campaign pressure</h3>
        <p class="mt-2 text-sm leading-6 text-slate-400">
          Area shows how many matched wars fired each day. Green and red lines track total round score taken that day by each bloc.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-3 text-sm md:min-w-[320px]">
        <div class="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Active days</div>
          <div class="mt-2 text-xl font-bold text-white">{{ props.dailyTimeline.totalBattleDays }}</div>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <div class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Peak day</div>
          <div class="mt-2 text-xl font-bold text-white">
            {{ props.dailyTimeline.hottestDay?.dateLabel || "-" }}
          </div>
          <div class="text-xs text-slate-500">
            {{ props.dailyTimeline.hottestDay?.battles || 0 }} battles
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 overflow-x-auto">
      <svg
        :viewBox="`0 0 ${props.dailyTimeline.width} ${props.dailyTimeline.height}`"
        class="min-w-[920px] w-full h-[320px]"
        role="img"
        aria-label="Campaign timeline"
      >
        <defs>
          <linearGradient id="campaignBattleArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(148,163,184,0.35)" />
            <stop offset="100%" stop-color="rgba(148,163,184,0.04)" />
          </linearGradient>
        </defs>

        <g v-for="step in 4" :key="step">
          <line
            :x1="26"
            :x2="props.dailyTimeline.width - 26"
            :y1="props.dailyTimeline.top + (props.dailyTimeline.innerHeight / 4) * step"
            :y2="props.dailyTimeline.top + (props.dailyTimeline.innerHeight / 4) * step"
            stroke="rgba(148,163,184,0.14)"
            stroke-dasharray="4 6"
          />
        </g>

        <path :d="props.dailyTimeline.battleArea" fill="url(#campaignBattleArea)" />
        <path :d="props.dailyTimeline.coalitionLine" fill="none" stroke="#34d399" stroke-width="4" stroke-linecap="round" />
        <path :d="props.dailyTimeline.hostileLine" fill="none" stroke="#fb7185" stroke-width="4" stroke-linecap="round" />

        <g v-for="point in props.dailyTimeline.battlePoints" :key="point.day.dateKey">
          <circle :cx="point.x" :cy="point.y" r="4" fill="#e2e8f0" fill-opacity="0.85" />
          <title>
            {{ point.day.dateKey }} | battles: {{ point.day.battles }} | coalition rounds:
            {{ point.day.coalitionRounds }} | hostile rounds: {{ point.day.hostileRounds }}
          </title>
        </g>

        <g
          v-for="(day, index) in props.dailyTimeline.days.filter((_, idx) => idx % Math.max(1, Math.ceil(props.dailyTimeline.days.length / 8)) === 0)"
          :key="day.dateKey"
        >
          <text
            :x="26 + (props.dailyTimeline.days.length === 1 ? (props.dailyTimeline.width - 52) / 2 : ((index * Math.max(1, Math.ceil(props.dailyTimeline.days.length / 8))) / (props.dailyTimeline.days.length - 1)) * (props.dailyTimeline.width - 52))"
            :y="props.dailyTimeline.height - 10"
            fill="#64748b"
            font-size="11"
            text-anchor="middle"
          >
            {{ day.dateLabel }}
          </text>
        </g>
      </svg>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
      <span class="inline-flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-slate-300"></span> matched wars per day</span>
      <span class="inline-flex items-center gap-2"><span class="h-2.5 w-6 rounded-full bg-emerald-400"></span> coalition round score</span>
      <span class="inline-flex items-center gap-2"><span class="h-2.5 w-6 rounded-full bg-rose-400"></span> hostile round score</span>
    </div>
  </div>
</template>
