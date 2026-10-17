import { onScopeDispose, readonly, ref } from 'vue'
import { realtimeChannel } from '@/api/mock'
import type { RealtimeEvent } from '@/api/types'

/**
 * Suscripción a eventos en tiempo real. Hoy escucha el BroadcastChannel del mock;
 * en el paso 5 tendrá la misma firma pero sobre WebSocket (sala = tablero).
 * Se limpia sola al destruirse el componente o el scope que la creó.
 */
export function useRealtime(handler: (event: RealtimeEvent) => void) {
  const connected = ref(false)
  const channel = realtimeChannel

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
