import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {arrayMove, SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {useMemo, useState} from 'react'
import {toast} from 'sonner'

import {CategorySectionHeader} from '@/components/category-section-header'
import {ExportPdfButton} from '@/components/export-pdf-button'
import {ItemDialog} from '@/components/item-dialog'
import {SortableItemRow} from '@/components/sortable-item-row'
import {Spinner} from '@/components/ui/spinner'
import {useCategories} from '@/hooks/use-categories'
import {useReorderItems} from '@/hooks/use-items'
import {usePeriod} from '@/hooks/use-period'
import {useSectionCollapse} from '@/hooks/use-section-collapse'
import type {Category, Item, PeriodItem} from '@/lib/api'
import {groupBySection} from '@/lib/categories'
import {formatDateLabel, todayISO, WEEKDAY_SHORT} from '@/lib/date'
import {cn} from '@/lib/utils'

// Column ids: 'unassigned' or 'day-{0..6}'.
const UNASSIGNED = 'unassigned'
const COLUMNS = [UNASSIGNED, ...WEEKDAY_SHORT.map((d) => `day-${d.value}`)] as const
type ColumnId = (typeof COLUMNS)[number]

function colDayOfWeek(col: ColumnId): number | null {
  return col === UNASSIGNED ? null : Number(col.split('-')[1])
}
function dayToCol(dow: number | null): ColumnId {
  return dow == null ? UNASSIGNED : (`day-${dow}` as ColumnId)
}

export function WeeklyPage() {
  const date = todayISO()
  const {data, isLoading} = usePeriod('weekly', date)
  const {data: categories = []} = useCategories()
  const reorder = useReorderItems()
  const [editing, setEditing] = useState<Item | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)

  // Local mirror of column state, edited optimistically while dragging.
  const [columns, setColumns] = useState<Record<ColumnId, PeriodItem[]>>(() => emptyColumns())
  const [prevDataItems, setPrevDataItems] = useState<PeriodItem[] | null>(null)
  if (data && data.items !== prevDataItems) {
    setPrevDataItems(data.items)
    setColumns(groupByDay(data.items))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
    useSensor(TouchSensor, {activationConstraint: {delay: 150, tolerance: 5}}),
  )

  const itemById = useMemo(() => {
    const map = new Map<number, PeriodItem>()
    Object.values(columns).forEach((arr) => arr.forEach((it) => map.set(it.id, it)))
    return map
  }, [columns])

  const activeItem = activeId == null ? null : itemById.get(activeId) ?? null

  function findContainer(id: number | string): ColumnId | null {
    if (typeof id === 'string' && (COLUMNS as readonly string[]).includes(id)) return id as ColumnId
    for (const c of COLUMNS) {
      if (columns[c].some((it) => it.id === id)) return c
    }
    return null
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id))
  }

  function handleDragOver(e: DragOverEvent) {
    const {active, over} = e
    if (!over) return
    const fromCol = findContainer(active.id)
    const toCol = findContainer(over.id)
    if (!fromCol || !toCol || fromCol === toCol) return

    setColumns((prev) => {
      const fromItems = prev[fromCol]
      const toItems = prev[toCol]
      const movingIdx = fromItems.findIndex((it) => it.id === active.id)
      if (movingIdx < 0) return prev
      const moving = fromItems[movingIdx]
      // Insert before the over item if it's a card; if over a column, append.
      let insertAt = toItems.findIndex((it) => it.id === over.id)
      if (insertAt < 0) insertAt = toItems.length
      return {
        ...prev,
        [fromCol]: fromItems.filter((it) => it.id !== active.id),
        [toCol]: [...toItems.slice(0, insertAt), {...moving, dayOfWeek: colDayOfWeek(toCol)}, ...toItems.slice(insertAt)],
      }
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    const {active, over} = e
    setActiveId(null)
    if (!over) return
    const fromCol = findContainer(active.id)
    const toCol = findContainer(over.id)
    if (!fromCol || !toCol) return

    if (fromCol === toCol) {
      const items = columns[fromCol]
      const oldIdx = items.findIndex((it) => it.id === active.id)
      const newIdx = items.findIndex((it) => it.id === over.id)
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return
      const reordered = arrayMove(items, oldIdx, newIdx)
      setColumns((prev) => ({...prev, [fromCol]: reordered}))
      persistColumns({...columns, [fromCol]: reordered})
    } else {
      // Across-column move was already applied in handleDragOver. Persist the snapshot.
      persistColumns(columns)
    }
  }

  function persistColumns(next: Record<ColumnId, PeriodItem[]>) {
    const rows = Object.entries(next).flatMap(([col, items]) =>
      items.map((it, i) => ({
        id: it.id,
        frequency: 'weekly' as const,
        sortOrder: i + 1,
        dayOfWeek: colDayOfWeek(col as ColumnId),
      })),
    )
    reorder.mutate(rows, {onError: (err) => toast.error(err instanceof Error ? err.message : 'Reorder failed')})
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex shrink-0 items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-tight">This week</h2>
          <p className="text-sm text-muted-foreground">
            {data && `${formatDateLabel(data.range.startISO)} – ${formatDateLabel(data.range.endISO)}`}
          </p>
        </div>
        <ExportPdfButton view={data} />
      </div>

      {isLoading && <Spinner />}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {/* Horizontally scrollable kanban filling the remaining viewport vertically.
            4 columns visible at iPad widths; the rest scroll. */}
        <div className="-mx-4 min-h-0 flex-1 overflow-x-auto px-4 pb-2">
          <div className="flex h-full gap-3">
            <Column
              id={UNASSIGNED}
              title="Unassigned"
              items={columns[UNASSIGNED]}
              categories={categories}
              date={date}
              onEdit={setEditing}
            />
            {WEEKDAY_SHORT.map((d) => {
              const col: ColumnId = `day-${d.value}` as ColumnId
              return (
                <Column
                  key={col}
                  id={col}
                  title={d.full}
                  items={columns[col]}
                  categories={categories}
                  date={date}
                  onEdit={setEditing}
                />
              )
            })}
          </div>
        </div>

        <DragOverlay>
          {activeItem && (
            <div className="rounded-lg border bg-card p-2 shadow-lg ring-2 ring-primary">
              <span className="text-sm font-medium">{activeItem.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <ItemDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing} />
    </div>
  )
}

function Column({
  id,
  title,
  items,
  categories,
  date,
  onEdit,
}: {
  id: ColumnId
  title: string
  items: PeriodItem[]
  categories: Category[]
  date: string
  onEdit: (item: PeriodItem) => void
}) {
  const {setNodeRef, isOver} = useDroppable({id})
  // Reorder items so they cluster by Category — drag visualises against this canonical order.
  // (A drag across visual sub-sections within the same column will re-cluster on persist.)
  const sections = groupBySection(items, categories)
  const clustered = sections.flatMap((s) => s.items)
  const hasCategorized = sections.some((s) => s.category != null)
  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Each column is a fixed 15.5rem so 4 fit fully on iPad horizontal with a peek of
        // the 5th to signal there's more to scroll to. Columns fill the parent's height
        // (flex cascade) and scroll their items independently.
        'flex h-full w-[15.5rem] shrink-0 flex-col rounded-lg border bg-muted/30 p-2 transition-colors',
        isOver && 'border-primary bg-primary/5',
      )}
    >
      <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <SortableContext items={clustered.map((it) => it.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {clustered.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground/60">—</p>}
          {sections.map((section) => (
            <ColumnSection
              key={section.category?.id ?? 'uncategorized'}
              section={section}
              columnId={id}
              showHeader={hasCategorized}
              date={date}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// One Category sub-section inside a weekly column. The header is rendered only when at least
// one Category is in use in this column — keeps the pre-Category column look intact.
function ColumnSection({
  section,
  columnId,
  showHeader,
  date,
  onEdit,
}: {
  section: ReturnType<typeof groupBySection>[number]
  columnId: ColumnId
  showHeader: boolean
  date: string
  onEdit: (item: PeriodItem) => void
}) {
  const view = `weekly:${columnId}`
  const [collapsed] = useSectionCollapse(view, section.category?.id ?? null)
  return (
    <div className="space-y-1.5">
      {showHeader && (
        <CategorySectionHeader category={section.category} view={view} count={section.items.length} variant="compact" />
      )}
      {!collapsed &&
        section.items.map((it) => (
          <SortableItemRow key={it.id} item={it} viewFrequency="weekly" date={date} onEdit={onEdit} />
        ))}
    </div>
  )
}

function emptyColumns(): Record<ColumnId, PeriodItem[]> {
  const obj = {[UNASSIGNED]: []} as Record<ColumnId, PeriodItem[]>
  for (const d of WEEKDAY_SHORT) obj[`day-${d.value}` as ColumnId] = []
  return obj
}

function groupByDay(items: PeriodItem[]): Record<ColumnId, PeriodItem[]> {
  const out = emptyColumns()
  for (const it of items) {
    out[dayToCol(it.dayOfWeek)].push(it)
  }
  return out
}
