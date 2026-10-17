<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'
import { resetMockDb } from '@/api/mock'
import { useBoardStore } from '@/stores/board'

const store = useBoardStore()
const { boards } = storeToRefs(store)

onMounted(() => store.fetchBoards())

function reset() {
  resetMockDb()
  location.reload()
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <p class="text-sm text-stone-500">Workspace</p>
    <h1 class="mb-6 text-2xl font-semibold">Estudio Fluxo</h1>

    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="b in boards" :key="b.id">
        <RouterLink
          :to="{ name: 'board', params: { boardId: b.id } }"
          class="flex h-28 items-end rounded-xl bg-gradient-to-br from-brand-600 to-emerald-800 p-4 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          {{ b.title }}
        </RouterLink>
      </li>
    </ul>

    <button type="button" class="mt-10 text-xs text-stone-500 underline hover:text-stone-700" @click="reset">
      Restablecer datos de prueba
    </button>
  </div>
</template>
