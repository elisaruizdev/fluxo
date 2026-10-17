<script setup lang="ts">
import type { Label, LabelColor } from '@/types/domain'

defineProps<{ label: Label; compact?: boolean }>()

const colorClasses: Record<LabelColor, string> = {
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  rose: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
  lime: 'bg-lime-100 text-lime-800 dark:bg-lime-900/60 dark:text-lime-200',
  slate: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
}
</script>

<template>
  <span
    class="inline-flex items-center rounded font-medium"
    :class="[colorClasses[label.color], compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs']"
  >
    {{ label.name }}
  </span>
</template>
