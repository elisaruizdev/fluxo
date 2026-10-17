const shortFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })
const longFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

export const formatShortDate = (iso: string) => shortFormatter.format(new Date(iso))
export const formatLongDate = (iso: string) => longFormatter.format(new Date(iso))

export type DueStatus = 'overdue' | 'soon' | 'later'

export function dueStatus(iso: string, now = Date.now()): DueStatus {
  const diff = new Date(iso).getTime() - now
  if (diff < 0) return 'overdue'
  if (diff < 2 * 86_400_000) return 'soon'
  return 'later'
}

/** ISO → valor para <input type="date"> (YYYY-MM-DD) */
export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
export const fromDateInput = (value: string) => (value ? new Date(`${value}T12:00:00`).toISOString() : null)
