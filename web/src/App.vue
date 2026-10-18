<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/ui/AppHeader.vue'
import ToastStack from '@/components/ui/ToastStack.vue'
import { useToasts } from '@/composables/useToasts'
import { useAuthStore } from '@/stores/auth'

const { expired } = storeToRefs(useAuthStore())
const router = useRouter()
const route = useRoute()
const { push: toast } = useToasts()

// La sesión se revocó o caducó en mitad del uso: al login, recordando dónde estaba
watch(expired, () => {
  toast('Tu sesión ha caducado. Vuelve a iniciar sesión.', 'error')
  void router.replace({ name: 'login', query: { redirect: route.fullPath } })
})
</script>

<template>
  <div class="flex h-dvh flex-col">
    <AppHeader />
    <main class="min-h-0 flex-1">
      <RouterView />
    </main>
    <ToastStack />
  </div>
</template>
