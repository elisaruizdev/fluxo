import { onScopeDispose, readonly, ref } from 'vue'
import { isMockMode } from '@/api'
import { realtimeChannel } from '@/api/mock'
import type { RealtimeEvent } from '@/api/types'

/**
 * Suscripción a eventos en tiempo real. En modo mock escucha el BroadcastChannel entre pestañas;
 * con la API real llegará en el paso 5 con la misma firma, sobre WebSocket (sala = tablero).
 * Se limpia sola al destruirse el componente o el scope que la creó.
 */
export function useRealtime(handler: (event: RealtimeEvent) => void) {
  const connected = ref(false)
  const channel = isMockMode ? realtimeChannel : null

  const onMessage = (e: MessageEvent<RealtimeEvent>) => handler(e.data)

  if (channel) {
    channel.addEventListener('message', onMessage)
    connected.value = true
  }

  onScopeDispose(() => {
    channel?.removeEventListener('message', onMessage)
    connected.value = false
  })

  return { connected: readonly(connected) }
}
