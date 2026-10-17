<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'

const { placeholder, cta } = defineProps<{ placeholder: string; cta: string }>()
// Eventos tipados: el padre recibe el texto ya validado
const emit = defineEmits<{ submit: [value: string] }>()

const open = ref(false)
const value = ref('')
const input = useTemplateRef<HTMLTextAreaElement>('input')

async function start() {
  open.value = true
  await nextTick() // esperar a que el <textarea> exista en el DOM
  input.value?.focus()
}

function submit() {
  const text = value.value.trim()
  if (!text) return
  emit('submit', text)
  value.value = ''
  input.value?.focus()
}

function cancel() {
  open.value = false
  value.value = ''
}
</script>

<template>
  <form v-if="open" class="space-y-2" @submit.prevent="submit">
    <textarea
      ref="input"
      v-model="value"
      rows="2"
      :placeholder="placeholder"
      class="w-full resize-none rounded-lg border border-stone-300 bg-white p-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-stone-600 dark:bg-stone-800"
      @keydown.enter.exact.prevent="submit"
      @keydown.esc="cancel"
    />
    <div class="flex gap-2">
      <button type="submit" class="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
        {{ cta }}
      </button>
      <button type="button" class="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700" @click="cancel">
        Cancelar
      </button>
    </div>
  </form>
  <button
    v-else
    type="button"
    class="w-full rounded-lg px-2 py-1.5 text-left text-sm text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
    @click="start"
  >
    + {{ cta }}
  </button>
</template>
