import { ref, watch } from 'vue'

type Theme = 'light' | 'dark'
const STORAGE_KEY = 'fluxo:theme'

// Estado a nivel de módulo: todos los componentes comparten el mismo ref
const theme = ref<Theme>(document.documentElement.classList.contains('dark') ? 'dark' : 'light')

watch(theme, (value) => {
  document.documentElement.classList.toggle('dark', value === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* noop */
  }
})

export function useTheme() {
  const toggle = () => (theme.value = theme.value === 'dark' ? 'light' : 'dark')
  return { theme, toggle }
}
