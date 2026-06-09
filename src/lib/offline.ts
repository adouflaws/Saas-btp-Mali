/* ─── Cache localStorage ──────────────────────────────────── */

export function cacheSet<T>(key: string, data: T): void {
  try {
    localStorage.setItem('btp_' + key, JSON.stringify(data))
  } catch {}
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem('btp_' + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/* ─── Queue offline ───────────────────────────────────────── */

export type QueuedAction = {
  id: string
  table: string
  op: 'insert' | 'update'
  data: Record<string, unknown>
  rowId?: string
  timestamp: string
}

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function queueAdd(action: Omit<QueuedAction, 'id' | 'timestamp'>): void {
  try {
    const q = queueGet()
    q.push({ ...action, id: genId(), timestamp: new Date().toISOString() })
    localStorage.setItem('btp_queue', JSON.stringify(q))
  } catch {}
}

export function queueGet(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem('btp_queue') || '[]')
  } catch {
    return []
  }
}

export function queueClear(): void {
  try { localStorage.removeItem('btp_queue') } catch {}
}

export function queueCount(): number {
  return queueGet().length
}
