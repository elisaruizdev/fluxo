import { onScopeDispose } from 'vue'

/** Escucha una tecla en window mientras viva el componente. Base para los atajos y Ctrl+K. */
export function onKeyStroke(key: string, handler: (e: KeyboardEvent) => void) {
  const listener = (e: KeyboardEvent) => {
    if (e.key === key) handler(e)
  }
  window.addEventListener('keydown', listener)
  onScopeDispose(() => window.removeEventListener('keydown', listener))
}
