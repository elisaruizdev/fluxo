<script setup lang="ts">
import { ref, watch } from 'vue'
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus'
import type { Card, Column } from '@/types/domain'
import CardItem from './CardItem.vue'
import InlineAddForm from './InlineAddForm.vue'

const props = defineProps<{ column: Column; cards: Card[] }>()
const emit = defineEmits<{
  move: [cardId: string, toColumnId: string, toIndex: number]
  addCard: [columnId: string, title: string]
}>()

// Copia local para el v-model de la librería: la fuente de verdad sigue siendo el store.
// Cuando el store cambia (optimista, rollback o evento remoto) la copia se resincroniza.
const local = ref<Card[]>([])
watch(
  () => props.cards,
  (cards) => (local.value = [...cards]),
  { immediate: true },
)

// @update = reordenar dentro de la lista, @add = llega desde otra lista
function onDrop(event: DraggableEvent<Card>) {
  if (event.newIndex === undefined) return
  emit('move', event.data.id, props.column.id, event.newIndex)
}
</script>

<template>
  <section class="flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-stone-200/70 dark:bg-stone-900" :aria-label="column.title">
    <header class="flex items-center justify-between px-3 pt-3 pb-2">
      <h2 class="text-sm font-semibold">{{ column.title }}</h2>
      <span class="text-xs text-stone-500">{{ cards.length }}</span>
    </header>

    <VueDraggable
      v-model="local"
      group="cards"
      :animation="150"
      ghost-class="drag-ghost"
      class="flex min-h-10 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-1"
      @update="onDrop"
      @add="onDrop"
    >
      <CardItem v-for="card in local" :key="card.id" :card="card" />
    </VueDraggable>

    <div class="p-2">
      <InlineAddForm placeholder="Título de la tarjeta" cta="Añadir tarjeta" @submit="emit('addCard', column.id, $event)" />
    </div>
  </section>
</template>

<style scoped>
.drag-ghost {
  opacity: 0.4;
}
</style>
