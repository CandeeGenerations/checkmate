import {useCallback, useSyncExternalStore} from 'react'

// Per (view, categoryId) collapse state, persisted to localStorage.
// Key shape: `checkmate.collapsed.<view>.<categoryId|"uncategorized">`.

const PREFIX = 'checkmate.collapsed'

function keyFor(view: string, categoryId: number | null): string {
  return `${PREFIX}.${view}.${categoryId ?? 'uncategorized'}`
}

// Module-level listeners so multiple components sharing a key re-render together.
const listeners = new Set<() => void>()
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function emit() {
  listeners.forEach((l) => l())
}

function read(view: string, categoryId: number | null): boolean {
  try {
    return localStorage.getItem(keyFor(view, categoryId)) === '1'
  } catch {
    return false
  }
}

export function useSectionCollapse(view: string, categoryId: number | null) {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => read(view, categoryId),
    () => false,
  )
  const toggle = useCallback(() => {
    try {
      const k = keyFor(view, categoryId)
      const next = localStorage.getItem(k) === '1' ? '0' : '1'
      if (next === '1') localStorage.setItem(k, '1')
      else localStorage.removeItem(k)
      emit()
    } catch {
      /* ignore — quota or privacy mode */
    }
  }, [view, categoryId])
  return [collapsed, toggle] as const
}
