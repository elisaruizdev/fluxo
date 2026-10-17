import { storeToRefs } from 'pinia'
import { toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useBoardStore } from '@/stores/board'
import { useRealtime } from './useRealtime'

/**
 * Une store + tiempo real para una vista de tablero.
 * Acepta un ref, un getter o un valor: así reacciona al cambiar :boardId en la URL.
 */
export function useBoard(boardId: MaybeRefOrGetter<string>) {
  const store = useBoardStore()
  // storeToRefs mantiene la reactividad al desestructurar (state y getters)
  const { board, sortedColumns, cardsByColumn, loading, error } = storeToRefs(store)

  watch(
    () => toValue(boardId),
    (id) => store.loadBoard(id),
    { immediate: true },
  )

  const { connected } = useRealtime(store.applyRemote)

  return {
    board,
    columns: sortedColumns,
    cardsByColumn,
    loading,
    error,
    connected,
    moveCard: store.moveCard,
    addCard: store.addCard,
    addColumn: store.addColumn,
  }
}
