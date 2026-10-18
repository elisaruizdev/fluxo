<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '@/components/ui/AuthLayout.vue'
import TextField from '@/components/ui/TextField.vue'
import { useFormSubmit } from '@/composables/useFormSubmit'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')

const { submit, submitting, error } = useFormSubmit(async () => {
  await auth.register(email.value, name.value, password.value)
  await router.replace({ name: 'home' })
})
</script>

<template>
  <AuthLayout title="Crea tu cuenta" subtitle="Tendrás un workspace propio para empezar.">
    <form class="space-y-4" @submit.prevent="submit()">
      <TextField v-model="name" label="Nombre" autocomplete="name" />
      <TextField v-model="email" label="Email" type="email" autocomplete="email" />
      <TextField v-model="password" label="Contraseña (mínimo 8 caracteres)" type="password" autocomplete="new-password" :minlength="8" />
      <p v-if="error" role="alert" class="text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>
      <button
        type="submit"
        :disabled="submitting"
        class="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {{ submitting ? 'Creando cuenta…' : 'Crear cuenta' }}
      </button>
    </form>
    <template #footer>
      ¿Ya tienes cuenta?
      <RouterLink :to="{ name: 'login' }" class="font-medium text-brand-600 hover:underline">Inicia sesión</RouterLink>
    </template>
  </AuthLayout>
</template>
