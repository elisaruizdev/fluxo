<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@/types/domain'

// Props destructuradas con valor por defecto (reactivas desde Vue 3.5)
const { user, size = 'sm' } = defineProps<{ user: User; size?: 'sm' | 'md' }>()

const initials = computed(() =>
  user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join(''),
)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
    :class="size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs'"
    :style="{ backgroundColor: user.avatarColor }"
    :title="user.name"
  >
    {{ initials }}
  </span>
</template>
