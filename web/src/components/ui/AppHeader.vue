<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import UserAvatar from './UserAvatar.vue'

const { theme, toggle } = useTheme()
const auth = useAuthStore()
const { user } = storeToRefs(auth)
const router = useRouter()

async function logout() {
  await auth.logout()
  useWorkspaceStore().$reset() // no dejar datos de la sesión anterior en memoria
  await router.replace({ name: 'login' })
}
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 dark:border-stone-800 dark:bg-stone-900"
  >
    <RouterLink to="/" class="flex items-center gap-2 font-semibold tracking-tight">
      <img src="/favicon.svg" alt="" class="size-7" />
      <span class="text-lg">Fluxo</span>
    </RouterLink>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
        :aria-label="theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
        @click="toggle"
      >
        {{ theme === 'dark' ? '☀︎ Claro' : '☾ Oscuro' }}
      </button>

      <template v-if="user">
        <UserAvatar :user="user" size="md" />
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          @click="logout"
        >
          Salir
        </button>
      </template>
    </div>
  </header>
</template>
