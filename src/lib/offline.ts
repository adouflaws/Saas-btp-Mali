import type { SupabaseClient } from '@supabase/supabase-js'

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

// Prévient les composants abonnés (useQueueCount) qu'une action a été ajoutée/retirée
export const QUEUE_EVENT = 'btp-queue-change'
function notifyQueueChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_EVENT))
}

export function queueAdd(action: Omit<QueuedAction, 'id' | 'timestamp'>): void {
  try {
    const q = queueGet()
    q.push({ ...action, id: genId(), timestamp: new Date().toISOString() })
    localStorage.setItem('btp_queue', JSON.stringify(q))
  } catch {}
  notifyQueueChange()
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
  notifyQueueChange()
}

export function queueCount(): number {
  return queueGet().length
}

/* ─── Synchronisation ─────────────────────────────────────── */

// Clés d'unicité des tables où une même action peut être rejouée (upsert)
const UPSERT_KEYS: Record<string, string> = {
  pointages: 'chantier_id,ouvrier_id,date_pointage',
}

export type SyncResult = { ok: number; errors: number; remaining: number }

// Une seule synchronisation à la fois : layout et pages écoutent tous l'événement
// "online", deux passes en parallèle rejouaient la même file (doublons, 409).
let inFlight: Promise<SyncResult> | null = null

export function syncQueue(supabase: SupabaseClient): Promise<SyncResult> {
  if (!inFlight) inFlight = runSync(supabase).finally(() => { inFlight = null })
  return inFlight
}

async function runSync(supabase: SupabaseClient): Promise<SyncResult> {
  const queue = queueGet()
  const done = new Set<string>()
  let errors = 0

  for (const action of queue) {
    try {
      let error: unknown = null
      if (action.op === 'insert') {
        const onConflict = UPSERT_KEYS[action.table]
        ;({ error } = onConflict
          ? await supabase.from(action.table).upsert(action.data, { onConflict })
          : await supabase.from(action.table).insert(action.data))
      } else if (action.op === 'update' && action.rowId && !action.rowId.startsWith('temp_')) {
        ;({ error } = await supabase.from(action.table).update(action.data).eq('id', action.rowId))
      }
      if (error) errors++
      else done.add(action.id)
    } catch {
      errors++
    }
  }

  // On ne retire que ce qui est passé ; une action ajoutée pendant la synchro reste en file
  const remaining = queueGet().filter(a => !done.has(a.id))
  try {
    if (remaining.length) localStorage.setItem('btp_queue', JSON.stringify(remaining))
    else localStorage.removeItem('btp_queue')
  } catch {}
  notifyQueueChange()
  return { ok: done.size, errors, remaining: remaining.length }
}
