import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Accesible sin sesión (login, registro) */
    public?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/registro', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { public: true } },
    {
      path: '/b/:boardId',
      name: 'board',
      component: () => import('@/views/BoardView.vue'),
      props: true,
      // Ruta hija: la tarjeta abierta vive en la URL (se puede compartir y recargar)
      children: [
        {
          path: 'c/:cardId',
          name: 'card',
          component: () => import('@/components/board/CardModal.vue'),
          props: true,
        },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
})

/**
 * Guard global de navegación: se ejecuta antes de cada cambio de ruta.
 * Devolver una ruta = redirigir; devolver true/undefined = continuar.
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init() // la primera vez espera a saber si hay sesión (refresh con la cookie)

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  if (to.meta.public && auth.isAuthenticated) return { name: 'home' }
})
