<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/components/ui/AuthLayout.vue'
import TextField from '@/components/ui/TextField.vue'
import { useFormSubmit } from '@/composables/useFormSubmit'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')

const { submit, submitting, error } = useFormSubmit(async () => {
  await auth.login(email.value, password.value)
  // Volver a donde se quería ir antes de que el guard mandara aquí
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  await router.replace(redirect.startsWith('/') ? redirect : '/')
})
</script>

<template>
  <AuthLayout title="Inicia sesión" subtitle="Te damos la bienvenida de nuevo a Fluxo.">
    <form class="space-y-4" @submit.prevent="submit()">
      <TextField v-model="email" label="Email" type="email" autocomplete="email" />
      <TextField v-model="password" label="Contraseña" type="password" autocomplete="current-password" />
      <p v-if="error" role="alert" class="text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>
      <button
        type="submit"
        :disabled="submitting"
        class="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {{ submitting ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
    <template #footer>
      ¿No tienes cuenta?
      <RouterLink :to="{ name: 'register', query: route.query }" class="font-medium text-brand-600 hover:underline">
        Regístrate
      </RouterLink>
    </template>
  </AuthLayout>
</template>
