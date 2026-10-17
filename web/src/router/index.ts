import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
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
