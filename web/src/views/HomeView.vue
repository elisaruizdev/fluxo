<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { isMockMode } from '@/api'
import { resetMockDb } from '@/api/mock'
import InlineAddForm from '@/components/board/InlineAddForm.vue'
import { useToasts } from '@/composables/useToasts'
import { useWorkspaceStore } from '@/stores/workspace'

const store = useWorkspaceStore()
const { workspaces, current, boards, loading } = storeToRefs(store)
const router = useRouter()
const { push: toast } = useToasts()

onMounted(() => store.load())

async function createBoard(title: string) {
  try {
    const board = await store.createBoard(title)
    await router.push({ name: 'board', params: { boardId: board.id } })
  } catch {
    toast('No se pudo crear el tablero.', 'error')
  }
}

function reset() {
  resetMockDb()
  location.reload()
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-sm text-stone-500">Workspace</p>
        <select
          v-if="workspaces.length > 1"
          :value="current?.id"
          aria-label="Workspace"
          class="-ml-1 rounded-lg bg-transparent px-1 text-2xl font-semibold outline-none focus:ring-2 focus:ring-brand-500/30"
          @change="store.select(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="w in workspaces" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
        <h1 v-else class="text-2xl font-semibold">{{ current?.name ?? '…' }}</h1>
      </div>
      <span v-if="current" class="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-medium dark:bg-stone-800">
        {{ current.role === 'ADMIN' ? 'Administración' : 'Miembro' }}
      </span>
    </div>

    <p v-if="loading && !boards.length" class="text-sm text-stone-500">Cargando…</p>

    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="b in boards" :key="b.id">
        <RouterLink
          :to="{ name: 'board', params: { boardId: b.id } }"
          class="flex h-28 items-end rounded-xl bg-gradient-to-br from-brand-600 to-emerald-800 p-4 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          {{ b.title }}
        </RouterLink>
      </li>
      <li v-if="current" class="rounded-xl bg-stone-200/60 p-3 dark:bg-stone-900">
        <InlineAddForm placeholder="Nombre del tablero" cta="Nuevo tablero" @submit="createBoard" />
      </li>
    </ul>

    <button v-if="isMockMode" type="button" class="mt-10 text-xs text-stone-500 underline hover:text-stone-700" @click="reset">
      Restablecer datos de prueba
    </button>
  </div>
</template>
