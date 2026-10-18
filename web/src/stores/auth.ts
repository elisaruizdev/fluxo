import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { api } from '@/api'
import { setUnauthorizedHandler } from '@/api/http'
import type { Session, User } from '@/types/domain'

export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)

  // Se resuelve cuando ya sabemos si hay sesión: el router lo espera antes de la primera navegación
  let ready: Promise<void> | null = null

  /** Al cargar la app el access token no existe (vivía en memoria): lo pedimos con la cookie */
  function init() {
    ready ??= api
      .refresh()
      .then((session) => {
        user.value = session?.user ?? null
      })
      .catch(() => {
        user.value = null
      })
    return ready
  }

  const start = (session: Session) => {
    user.value = session.user
  }

  async function login(email: string, password: string) {
    start(await api.login(email, password))
  }

  async function register(email: string, name: string, password: string) {
    start(await api.register(email, name, password))
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      user.value = null
    }
  }

  // Si el refresh falla a mitad de uso (sesión revocada), el router nos mandará al login
  const expired = ref(0)
  setUnauthorizedHandler(() => {
    user.value = null
    expired.value++
  })

  return { user, isAuthenticated, expired, init, login, register, logout }
})
