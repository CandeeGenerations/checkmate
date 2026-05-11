import {SortableItemRow} from '@/components/sortable-item-row'
import {useReorderItems} from '@/hooks/use-items'
import type {PeriodItem} from '@/lib/api'
import type {Frequency} from '@/lib/date'
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {SortableContext, arrayMove, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {useState} from 'react'
import {toast} from 'sonner'

interface SortableFlatListProps {
  items: PeriodItem[]
  frequency: Frequency
  date: string
  onEdit: (item: PeriodItem) => void
  metaLabel?: (item: PeriodItem) => string | undefined
}

export function SortableFlatList({items, frequency, date, onEdit, metaLabel}: SortableFlatListProps) {
  const reorder = useReorderItems()
  const [local, setLocal] = useState<PeriodItem[]>(items)
  const [prevItems, setPrevItems] = useState(items)
  const [activeId, setActiveId] = useState<number | null>(null)

  // Re-sync local state when the server data changes (React docs pattern for
  // "adjust state on prop change" — runs during render, not in an effect).
  if (items !== prevItems) {
    setPrevItems(items)
    setLocal(items)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
    useSensor(TouchSensor, {activationConstraint: {delay: 150, tolerance: 5}}),
  )

  function handleStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id))
  }

  function handleEnd(e: DragEndEvent) {
    setActiveId(null)
    const {active, over} = e
    if (!over || active.id === over.id) return
    const oldIdx = local.findIndex((it) => it.id === active.id)
    const newIdx = local.findIndex((it) => it.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(local, oldIdx, newIdx)
    setLocal(next)
    // Use each item's own frequency so a mixed-frequency view (Daily) can reorder rows
    // without inadvertently rewriting an item's frequency to the view's.
    const rows = next.map((it, i) => ({id: it.id, frequency: it.frequency, sortOrder: i + 1}))
    reorder.mutate(rows, {onError: (err) => toast.error(err instanceof Error ? err.message : 'Reorder failed')})
  }

  const active = activeId == null ? null : (local.find((it) => it.id === activeId) ?? null)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={local.map((it) => it.id)} strategy={verticalListSortingStrategy}>
        {/* Bleed list to screen edges on mobile; card-style with gaps on sm+. */}
        <div className="-mx-4 border-t sm:mx-0 sm:space-y-2 sm:border-0">
          {local.map((it) => (
            <SortableItemRow
              key={it.id}
              item={it}
              viewFrequency={frequency}
              date={date}
              onEdit={onEdit}
              metaLabel={metaLabel?.(it)}
              variant="flat"
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {active && (
          <div className="rounded-lg border bg-card p-2 shadow-lg ring-2 ring-primary">
            <span className="text-sm font-medium">{active.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
