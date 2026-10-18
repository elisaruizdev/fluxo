import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { api } from '@/api'
import type { Board, Workspace } from '@/types/domain'

const STORAGE_KEY = 'fluxo:workspace'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref<Workspace[]>([])
  const boards = ref<Board[]>([])
  const currentId = ref<string | null>(readStoredId())
  const loading = ref(false)

  const current = computed(() => workspaces.value.find((w) => w.id === currentId.value) ?? workspaces.value[0] ?? null)

  // Recordar el último workspace abierto (preferencia por navegador, no dato crítico)
  watch(currentId, (id) => {
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* noop */
    }
  })

  async function load() {
    loading.value = true
    try {
      workspaces.value = await api.listWorkspaces()
      if (current.value) await loadBoards(current.value.id)
    } finally {
      loading.value = false
    }
  }

  async function select(workspaceId: string) {
    currentId.value = workspaceId
    await loadBoards(workspaceId)
  }

  async function loadBoards(workspaceId: string) {
    boards.value = await api.listBoards(workspaceId)
  }

  async function createBoard(title: string) {
    if (!current.value) throw new Error('No hay workspace seleccionado')
    const board = await api.createBoard(current.value.id, title)
    boards.value.push(board)
    return board
  }

  function $reset() {
    workspaces.value = []
    boards.value = []
  }

  return { workspaces, boards, current, loading, load, select, createBoard, $reset }
})

function readStoredId() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
