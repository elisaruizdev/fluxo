<script setup lang="ts">
import { useToasts } from '@/composables/useToasts'

const { toasts, dismiss } = useToasts()
</script>

<template>
  <!-- Teleport saca el nodo del árbol del componente y lo monta en <body> -->
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      <TransitionGroup
        enter-from-class="translate-y-2 opacity-0"
        leave-to-class="opacity-0"
        enter-active-class="transition duration-200"
        leave-active-class="transition duration-200"
      >
        <button
          v-for="t in toasts"
          :key="t.id"
          type="button"
          class="pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm shadow-lg"
          :class="t.tone === 'error' ? 'bg-rose-600 text-white' : 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'"
          @click="dismiss(t.id)"
        >
          {{ t.message }}
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
