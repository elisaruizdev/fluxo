<script setup lang="ts">
import AppHeader from '@/components/ui/AppHeader.vue'
import ToastStack from '@/components/ui/ToastStack.vue'
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
