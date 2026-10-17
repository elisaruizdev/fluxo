<script setup lang="ts">
import BoardColumn from '@/components/board/BoardColumn.vue'
import InlineAddForm from '@/components/board/InlineAddForm.vue'
import { useBoard } from '@/composables/useBoard'

// `props: true` en la ruta → :boardId llega como prop en vez de leer useRoute()
const props = defineProps<{ boardId: string }>()

// Pasamos un getter para que useBoard reaccione si cambia el parámetro de la URL
const { board, columns, cardsByColumn, loading, error, connected, moveCard, addCard, addColumn } = useBoard(
  () => props.boardId,
)
</script>

<template>
  <div class="flex h-full flex-col">
    <div v-if="loading && !board" class="p-6 text-sm text-stone-500">Cargando tablero…</div>

    <div v-else-if="error || !board" class="p-6">
      <p class="font-medium">No se ha encontrado este tablero.</p>
      <RouterLink to="/" class="text-sm text-brand-600 hover:underline">Volver al inicio</RouterLink>
    </div>

    <template v-else>
      <div class="flex items-center gap-3 px-4 py-3">
        <h1 class="text-lg font-semibold">{{ board.title }}</h1>
        <span
          class="flex items-center gap-1.5 text-xs text-stone-500"
          :title="connected ? 'Sincronizado entre pestañas' : 'Sin tiempo real'"
        >
          <span class="size-2 rounded-full" :class="connected ? 'bg-emerald-500' : 'bg-stone-400'" />
          {{ connected ? 'En vivo' : 'Sin conexión' }}
        </span>
      </div>

      <div class="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-4 pb-4">
        <BoardColumn
          v-for="column in columns"
          :key="column.id"
          :column="column"
          :cards="cardsByColumn[column.id] ?? []"
          @move="moveCard"
          @add-card="addCard"
        />
        <div class="w-72 shrink-0 rounded-xl bg-stone-200/40 p-2 dark:bg-stone-900/50">
          <InlineAddForm placeholder="Nombre de la lista" cta="Añadir lista" @submit="addColumn" />
        </div>
      </div>
    </template>

    <!-- Ruta hija (modal de tarjeta) -->
    <RouterView />
  </div>
</template>
