<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { onKeyStroke } from '@/composables/useKeyStroke'
import { useRealtime } from '@/composables/useRealtime'
import { useBoardStore } from '@/stores/board'
import type { Comment } from '@/types/domain'
import { formatLongDate, fromDateInput, toDateInput } from '@/utils/dates'
import LabelChip from './LabelChip.vue'

const props = defineProps<{ boardId: string; cardId: string }>()

const router = useRouter()
const store = useBoardStore()

const card = computed(() => store.cards[props.cardId])
const close = () => router.push({ name: 'board', params: { boardId: props.boardId } })

onKeyStroke('Escape', close)

// --- Edición: borrador local y guardado al salir del campo ---
const title = ref('')
const description = ref('')
watch(
  card,
  (c) => {
    if (!c) return
    title.value = c.title
    description.value = c.description
  },
  { immediate: true },
)

function saveTitle() {
  const value = title.value.trim()
  if (card.value && value && value !== card.value.title) store.updateCard(card.value.id, { title: value })
  else if (card.value) title.value = card.value.title
}

function saveDescription() {
  if (card.value && description.value !== card.value.description)
    store.updateCard(card.value.id, { description: description.value })
}

function toggleLabel(labelId: string) {
  if (!card.value) return
  const ids = card.value.labelIds
  store.updateCard(card.value.id, { labelIds: ids.includes(labelId) ? ids.filter((i) => i !== labelId) : [...ids, labelId] })
}

// Escritura de un computed: get lee del store, set dispara la mutación optimista
const assigneeId = computed({
  get: () => card.value?.assigneeId ?? '',
  set: (v: string) => card.value && store.updateCard(card.value.id, { assigneeId: v || null }),
})

const dueDate = computed({
  get: () => toDateInput(card.value?.dueDate ?? null),
  set: (v: string) => card.value && store.updateCard(card.value.id, { dueDate: fromDateInput(v) }),
})

async function remove() {
  if (!card.value || !confirm('¿Eliminar esta tarjeta?')) return
  await close()
  await store.removeCard(props.cardId)
}

// --- Comentarios ---
const comments = ref<Comment[]>([])
const newComment = ref('')

/** Fusiona por id: llegan por tres vías (carga inicial, envío propio y tiempo real) y en cualquier orden */
function mergeComments(incoming: Comment[]) {
  const byId = new Map(comments.value.map((c) => [c.id, c]))
  for (const c of incoming) byId.set(c.id, c)
  comments.value = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

watch(
  () => props.cardId,
  async (id) => {
    comments.value = []
    const loaded = await api.listComments(id)
    // Si mientras tanto se abrió otra tarjeta, esta respuesta ya no sirve
    if (id === props.cardId) mergeComments(loaded)
  },
  { immediate: true },
)

useRealtime((e) => {
  if (e.type === 'comment.created' && e.comment.cardId === props.cardId) mergeComments([e.comment])
})

async function sendComment() {
  const body = newComment.value.trim()
  if (!body) return
  newComment.value = ''
  mergeComments([await api.addComment(props.cardId, body)])
}

const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-stone-600 dark:bg-stone-800'
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10" @click.self="close">
      <article
        role="dialog"
        aria-modal="true"
        :aria-label="card?.title ?? 'Tarjeta'"
        class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-stone-900"
      >
        <p v-if="!card" class="text-sm text-stone-500">Esta tarjeta no existe o se ha eliminado.</p>

        <template v-else>
          <div class="flex items-start gap-3">
            <input
              v-model="title"
              aria-label="Título"
              class="flex-1 rounded-lg bg-transparent px-2 py-1 text-xl font-semibold outline-none focus:bg-stone-100 dark:focus:bg-stone-800"
              @blur="saveTitle"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
            <button type="button" class="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="Cerrar" @click="close">
              ✕
            </button>
          </div>

          <div class="mt-5 grid gap-6 sm:grid-cols-[1fr_200px]">
            <div class="space-y-6">
              <section>
                <h3 class="mb-2 text-sm font-semibold">Descripción</h3>
                <textarea v-model="description" rows="4" :class="inputClass" placeholder="Añade más detalles…" @blur="saveDescription" />
              </section>

              <section>
                <h3 class="mb-2 text-sm font-semibold">Comentarios</h3>
                <form class="mb-4 flex gap-2" @submit.prevent="sendComment">
                  <input v-model="newComment" :class="inputClass" placeholder="Escribe un comentario…" />
                  <button type="submit" class="rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">Enviar</button>
                </form>
                <ul class="space-y-3">
                  <li v-for="c in comments" :key="c.id" class="flex gap-2">
                    <UserAvatar v-if="store.memberById[c.authorId]" :user="store.memberById[c.authorId]!" size="md" />
                    <div>
                      <p class="text-xs text-stone-500">
                        <span class="font-medium text-stone-800 dark:text-stone-200">{{ store.memberById[c.authorId]?.name }}</span>
                        · {{ formatLongDate(c.createdAt) }}
                      </p>
                      <p class="text-sm">{{ c.body }}</p>
                    </div>
                  </li>
                </ul>
              </section>
            </div>

            <aside class="space-y-5">
              <section>
                <h3 class="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">Etiquetas</h3>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="label in store.labels"
                    :key="label.id"
                    type="button"
                    :aria-pressed="card.labelIds.includes(label.id)"
                    class="rounded transition"
                    :class="card.labelIds.includes(label.id) ? 'ring-2 ring-stone-900 dark:ring-white' : 'opacity-50 hover:opacity-100'"
                    @click="toggleLabel(label.id)"
                  >
                    <LabelChip :label="label" />
                  </button>
                </div>
              </section>

              <label class="block">
                <span class="mb-2 block text-xs font-semibold tracking-wide text-stone-500 uppercase">Asignado</span>
                <select v-model="assigneeId" :class="inputClass">
                  <option value="">Sin asignar</option>
                  <option v-for="m in store.members" :key="m.id" :value="m.id">{{ m.name }}</option>
                </select>
              </label>

              <label class="block">
                <span class="mb-2 block text-xs font-semibold tracking-wide text-stone-500 uppercase">Fecha límite</span>
                <input v-model="dueDate" type="date" :class="inputClass" />
              </label>

              <button type="button" class="w-full rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950" @click="remove">
                Eliminar tarjeta
              </button>
            </aside>
          </div>
        </template>
      </article>
    </div>
  </Teleport>
</template>
