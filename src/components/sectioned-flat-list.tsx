import {CategorySectionHeader} from '@/components/category-section-header'
import {SortableFlatList} from '@/components/sortable-flat-list'
import {SortableItemRow} from '@/components/sortable-item-row'
import {useCategories, useReorderCategories} from '@/hooks/use-categories'
import {useReorderItems} from '@/hooks/use-items'
import {useSectionCollapse} from '@/hooks/use-section-collapse'
import type {Category, PeriodItem} from '@/lib/api'
import {groupBySection} from '@/lib/categories'
import type {Frequency} from '@/lib/date'
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {SortableContext, arrayMove, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVertical} from 'lucide-react'
import {useMemo, useState} from 'react'
import {toast} from 'sonner'

interface SectionedFlatListProps {
  items: PeriodItem[]
  frequency: Frequency
  date: string
  onEdit: (item: PeriodItem) => void
  metaLabel?: (item: PeriodItem) => string | undefined
}

// Section drop-target id convention: "cat-<id>" for a named Category, "cat-none" for
// Uncategorized. Section-header drag id convention: "section-<id>" (only named Categories are
// draggable — Uncategorized is pinned to the top).
const UNCATEGORIZED_DROP_ID = 'cat-none'
function catDropId(categoryId: number | null): string {
  return categoryId == null ? UNCATEGORIZED_DROP_ID : `cat-${categoryId}`
}
function sectionDragId(categoryId: number): string {
  return `section-${categoryId}`
}

interface SectionState {
  category: Category | null
  items: PeriodItem[]
}

export function SectionedFlatList({items, frequency, date, onEdit, metaLabel}: SectionedFlatListProps) {
  const {data: categories = []} = useCategories()
  const reorderItems = useReorderItems()
  const reorderCategories = useReorderCategories()

  // Local optimistic mirror of section layout. Resynced when the server data or category list
  // changes (same render-time-reset pattern used elsewhere in this codebase).
  const initial = groupBySection(items, categories)
  const [sections, setSections] = useState<SectionState[]>(initial)
  const [prevItems, setPrevItems] = useState(items)
  const [prevCategories, setPrevCategories] = useState(categories)
  if (items !== prevItems || categories !== prevCategories) {
    setPrevItems(items)
    setPrevCategories(categories)
    setSections(groupBySection(items, categories))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
    useSensor(TouchSensor, {activationConstraint: {delay: 150, tolerance: 5}}),
  )

  const namedSections = useMemo(() => sections.filter((s) => s.category != null), [sections])
  const sectionIds = useMemo(() => namedSections.map((s) => sectionDragId(s.category!.id)), [namedSections])
  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections])
  const itemById = useMemo(() => new Map(allItems.map((it) => [it.id, it])), [allItems])

  const [activeItemId, setActiveItemId] = useState<number | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const activeItem = activeItemId == null ? null : (itemById.get(activeItemId) ?? null)

  // Early exit: nothing to show.
  if (sections.length === 0) return null
  // Pre-Category fallback: no named categories at all → render a single flat list (no headers).
  if (namedSections.length === 0) {
    return (
      <SimpleSortableList items={allItems} frequency={frequency} date={date} onEdit={onEdit} metaLabel={metaLabel} />
    )
  }

  function findItemSection(itemId: number): number {
    return sections.findIndex((s) => s.items.some((it) => it.id === itemId))
  }
  function findDropSection(overId: string | number): number {
    // Over a section drop target.
    if (typeof overId === 'string') {
      if (overId === UNCATEGORIZED_DROP_ID) return sections.findIndex((s) => s.category == null)
      if (overId.startsWith('cat-')) {
        const cid = Number(overId.slice(4))
        return sections.findIndex((s) => s.category?.id === cid)
      }
      if (overId.startsWith('section-')) {
        const cid = Number(overId.slice(8))
        return sections.findIndex((s) => s.category?.id === cid)
      }
    }
    // Over another item.
    return findItemSection(Number(overId))
  }

  function handleDragStart(e: DragStartEvent) {
    const id = e.active.id
    if (typeof id === 'string' && id.startsWith('section-')) {
      setActiveSectionId(id)
    } else {
      setActiveItemId(Number(id))
    }
  }

  function handleDragOver(e: DragOverEvent) {
    if (activeSectionId != null) return // section drags don't need optimistic moves
    const {active, over} = e
    if (!over) return
    const activeId = Number(active.id)
    if (Number.isNaN(activeId)) return
    const fromIdx = findItemSection(activeId)
    const toIdx = findDropSection(over.id)
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return

    setSections((prev) => {
      const next = prev.map((s) => ({...s, items: [...s.items]}))
      const fromItems = next[fromIdx].items
      const toItems = next[toIdx].items
      const movingIdx = fromItems.findIndex((it) => it.id === activeId)
      if (movingIdx < 0) return prev
      const moving = fromItems[movingIdx]
      const newCategoryId = next[toIdx].category?.id ?? null
      const reassigned = {...moving, categoryId: newCategoryId}
      // Insert before over item if over an item; if over a section container, append.
      let insertAt = toItems.findIndex((it) => it.id === over.id)
      if (insertAt < 0) insertAt = toItems.length
      next[fromIdx] = {...next[fromIdx], items: fromItems.filter((_, i) => i !== movingIdx)}
      next[toIdx] = {...next[toIdx], items: [...toItems.slice(0, insertAt), reassigned, ...toItems.slice(insertAt)]}
      return next
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    const {active, over} = e
    const wasSection = activeSectionId != null
    setActiveItemId(null)
    setActiveSectionId(null)
    if (!over) return

    if (wasSection) {
      // Reorder named sections. `active.id` and `over.id` are both 'section-<id>'.
      if (typeof active.id !== 'string' || typeof over.id !== 'string') return
      if (active.id === over.id) return
      const oldIdx = sectionIds.indexOf(active.id)
      const newIdx = sectionIds.indexOf(over.id)
      if (oldIdx < 0 || newIdx < 0) return
      const nextNamed = arrayMove(namedSections, oldIdx, newIdx)
      const uncategorized = sections.find((s) => s.category == null)
      const nextSections = uncategorized ? [uncategorized, ...nextNamed] : nextNamed
      setSections(nextSections)
      const rows = nextNamed.map((s, i) => ({id: s.category!.id, sortOrder: i + 1}))
      reorderCategories.mutate(rows, {
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Reorder failed'),
      })
      return
    }

    // Item drag end. The optimistic move already happened in handleDragOver for cross-section
    // changes; in-section reorder we need to apply on drop.
    const activeId = Number(active.id)
    if (Number.isNaN(activeId)) return
    const sIdx = findItemSection(activeId)
    if (sIdx < 0) return
    const list = sections[sIdx].items
    const fromIdx = list.findIndex((it) => it.id === activeId)
    let toIdx = list.findIndex((it) => it.id === over.id)
    if (toIdx < 0) toIdx = list.length - 1
    let final = sections
    if (fromIdx !== toIdx && fromIdx >= 0 && toIdx >= 0) {
      const reordered = arrayMove(list, fromIdx, toIdx)
      final = sections.map((s, i) => (i === sIdx ? {...s, items: reordered} : s))
      setSections(final)
    }
    // Persist the whole sectioned layout: items get fresh sortOrder per (frequency, category).
    persistItems(final)
  }

  function persistItems(state: SectionState[]) {
    const rows = state.flatMap((section) =>
      section.items.map((it, i) => ({
        id: it.id,
        frequency: it.frequency,
        sortOrder: i + 1,
        categoryId: section.category?.id ?? null,
      })),
    )
    reorderItems.mutate(rows, {
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Reorder failed'),
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveItemId(null)
        setActiveSectionId(null)
      }}
    >
      <div className="space-y-3">
        {sections.map((section) =>
          section.category == null ? (
            <SectionView
              key="uncategorized"
              section={section}
              frequency={frequency}
              date={date}
              onEdit={onEdit}
              metaLabel={metaLabel}
            />
          ) : null,
        )}
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          {namedSections.map((section) => (
            <SortableSection
              key={section.category!.id}
              section={section}
              frequency={frequency}
              date={date}
              onEdit={onEdit}
              metaLabel={metaLabel}
            />
          ))}
        </SortableContext>
      </div>
      <DragOverlay>
        {activeItem && (
          <div className="rounded-lg border bg-card p-2 shadow-lg ring-2 ring-primary">
            <span className="text-sm font-medium">{activeItem.title}</span>
          </div>
        )}
        {activeSectionId != null && (
          <div className="rounded-md bg-card p-2 shadow-lg ring-2 ring-primary">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {namedSections.find((s) => sectionDragId(s.category!.id) === activeSectionId)?.category?.name}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function SortableSection({
  section,
  frequency,
  date,
  onEdit,
  metaLabel,
}: {
  section: SectionState
  frequency: Frequency
  date: string
  onEdit: (item: PeriodItem) => void
  metaLabel?: (item: PeriodItem) => string | undefined
}) {
  const id = sectionDragId(section.category!.id)
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id})
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="cursor-grab touch-none px-0.5 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
      aria-label="Drag to reorder section"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  )
  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      <SectionView
        section={section}
        frequency={frequency}
        date={date}
        onEdit={onEdit}
        metaLabel={metaLabel}
        dragHandle={handle}
      />
    </div>
  )
}

function SectionView({
  section,
  frequency,
  date,
  onEdit,
  metaLabel,
  dragHandle,
}: {
  section: SectionState
  frequency: Frequency
  date: string
  onEdit: (item: PeriodItem) => void
  metaLabel?: (item: PeriodItem) => string | undefined
  dragHandle?: React.ReactNode
}) {
  const [collapsed] = useSectionCollapse(frequency, section.category?.id ?? null)
  const dropId = catDropId(section.category?.id ?? null)
  const {setNodeRef, isOver} = useDroppable({id: dropId})
  return (
    <div className="space-y-2">
      <CategorySectionHeader
        category={section.category}
        view={frequency}
        count={section.items.length}
        dragHandle={dragHandle}
      />
      {!collapsed && (
        <div ref={setNodeRef} className={isOver ? 'rounded-md ring-2 ring-primary/40' : undefined}>
          <SortableContext items={section.items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
            <div className="-mx-4 border-t sm:mx-0 sm:space-y-2 sm:border-0">
              {section.items.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground sm:px-2">Drop items here.</p>
              )}
              {section.items.map((it) => (
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
        </div>
      )}
    </div>
  )
}

// Simple fallback when nothing is categorized — re-uses the bare SortableFlatList semantics
// without the section chrome (preserves the pre-Category look).
function SimpleSortableList(props: SectionedFlatListProps) {
  return <SortableFlatList {...props} />
}
