<script setup lang="ts">
defineProps<{ title: string; subtitle: string }>()
</script>

<template>
  <div class="grid h-full place-items-center px-4 py-10">
    <div class="w-full max-w-sm">
      <img src="/favicon.svg" alt="" class="mb-6 size-10" />
      <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
      <p class="mt-1 mb-6 text-sm text-stone-500 dark:text-stone-400">{{ subtitle }}</p>
      <!-- Slot por defecto: el formulario concreto lo pone cada vista -->
      <slot />
      <!-- Slot con nombre para el enlace de abajo -->
      <p class="mt-6 text-center text-sm text-stone-500 dark:text-stone-400">
        <slot name="footer" />
      </p>
    </div>
  </div>
</template>
