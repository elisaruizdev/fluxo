<script setup lang="ts">
// defineModel crea la prop `modelValue` y el evento `update:modelValue` de golpe:
// el padre puede usar <TextField v-model="email" />
const model = defineModel<string>({ required: true })

defineProps<{
  label: string
  type?: 'text' | 'email' | 'password'
  autocomplete?: string
  minlength?: number
}>()
</script>

<template>
  <label class="block">
    <span class="mb-1 block text-sm font-medium">{{ label }}</span>
    <input
      v-model="model"
      :type="type ?? 'text'"
      :autocomplete="autocomplete"
      :minlength="minlength"
      required
      class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-stone-600 dark:bg-stone-800"
    />
  </label>
</template>
