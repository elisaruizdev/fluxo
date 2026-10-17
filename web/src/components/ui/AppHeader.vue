<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { theme, toggle } = useTheme()
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 dark:border-stone-800 dark:bg-stone-900"
  >
    <RouterLink to="/" class="flex items-center gap-2 font-semibold tracking-tight">
      <img src="/favicon.svg" alt="" class="size-7" />
      <span class="text-lg">Fluxo</span>
    </RouterLink>

    <button
      type="button"
      class="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
      :aria-label="theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
      @click="toggle"
    >
      {{ theme === 'dark' ? '☀︎ Claro' : '☾ Oscuro' }}
    </button>
  </header>
</template>
