import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'error'
}

const toasts = ref<Toast[]>([])
let nextId = 0

export function useToasts() {
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(message: string, tone: Toast['tone'] = 'info', ms = 4000) {
    const id = ++nextId
    toasts.value.push({ id, message, tone })
    setTimeout(() => dismiss(id), ms)
  }

  return { toasts, push, dismiss }
}
