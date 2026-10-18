import { ref } from 'vue'
import { ApiError } from '@/api'

/** Estado de envío + mensaje de error legible, para no repetirlo en cada formulario */
export function useFormSubmit<TArgs extends unknown[]>(action: (...args: TArgs) => Promise<unknown>) {
  const submitting = ref(false)
  const error = ref<string | null>(null)

  async function submit(...args: TArgs) {
    submitting.value = true
    error.value = null
    try {
      await action(...args)
      return true
    } catch (e) {
      error.value = toMessage(e)
      return false
    } finally {
      submitting.value = false
    }
  }

  return { submit, submitting, error }
}

function toMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 429) return 'Demasiados intentos. Espera un minuto.'
    const message = e.data.message
    return Array.isArray(message) ? message.join('. ') : e.message
  }
  return 'No se pudo conectar con el servidor.'
}
