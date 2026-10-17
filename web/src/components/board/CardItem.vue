<script setup lang="ts">
import { computed } from 'vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useBoardStore } from '@/stores/board'
import type { Card } from '@/types/domain'
import { dueStatus, formatShortDate } from '@/utils/dates'
import LabelChip from './LabelChip.vue'

const props = defineProps<{ card: Card }>()

const store = useBoardStore()
const labels = computed(() => props.card.labelIds.map((id) => store.labelById[id]).filter((l) => l !== undefined))
const assignee = computed(() => (props.card.assigneeId ? store.memberById[props.card.assigneeId] : undefined))
const due = computed(() => (props.card.dueDate ? dueStatus(props.card.dueDate) : null))
const isTemp = computed(() => props.card.id.startsWith('temp_'))
</script>

<template>
  <RouterLink
    :to="{ name: 'card', params: { cardId: card.id } }"
    class="block cursor-grab rounded-lg border border-stone-200 bg-white p-3 shadow-sm transition hover:border-brand-500 active:cursor-grabbing dark:border-stone-700 dark:bg-stone-800"
    :class="{ 'pointer-events-none opacity-60': isTemp }"
  >
    <div v-if="labels.length" class="mb-2 flex flex-wrap gap-1">
      <LabelChip v-for="label in labels" :key="label.id" :label="label" compact />
    </div>

    <p class="text-sm leading-snug">{{ card.title }}</p>

    <div v-if="due || assignee || card.description" class="mt-2 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
      <span
        v-if="due && card.dueDate"
        class="rounded px-1.5 py-0.5"
        :class="{
          'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200': due === 'overdue',
          'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200': due === 'soon',
        }"
      >
        {{ formatShortDate(card.dueDate) }}
      </span>
      <span v-if="card.description" title="Tiene descripción">≡</span>
      <UserAvatar v-if="assignee" :user="assignee" class="ml-auto" />
    </div>
  </RouterLink>
</template>
