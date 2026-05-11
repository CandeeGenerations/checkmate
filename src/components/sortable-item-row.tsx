import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {useToggleCompletion} from '@/hooks/use-period'
import type {PeriodItem} from '@/lib/api'
import type {Frequency} from '@/lib/date'
import {cn} from '@/lib/utils'
import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVertical, Pencil} from 'lucide-react'

interface SortableItemRowProps {
  item: PeriodItem
  viewFrequency: Frequency
  date: string
  onEdit: (item: PeriodItem) => void
  metaLabel?: string
  /** 'card' (default) for kanban columns, 'flat' for full-bleed flat lists. */
  variant?: 'card' | 'flat'
}

export function SortableItemRow({
  item,
  viewFrequency,
  date,
  onEdit,
  metaLabel,
  variant = 'card',
}: SortableItemRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: item.id})
  const toggle = useToggleCompletion(viewFrequency, date)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`${item.title} — long-press or drag to reorder`}
      className={cn(
        // The whole row is the drag source. TouchSensor's delay-based activation
        // (configured in the parent DndContext) lets a quick tap fall through to
        // the checkbox / title / edit handlers, while a 150ms hold starts a drag.
        // `select-none` + `[-webkit-touch-callout:none]` stop iOS/Android from
        // turning a long-press into a text-selection / callout gesture.
        'group flex cursor-grab items-center gap-2 transition-colors select-none [-webkit-touch-callout:none] active:cursor-grabbing',
        variant === 'card'
          ? 'rounded-lg border bg-card p-2'
          : // Flat: edge-to-edge dividers on mobile, card style on sm+.
            'border-b bg-card/40 px-4 py-2.5 sm:rounded-lg sm:border sm:bg-card sm:p-2.5',
        item.completed && 'opacity-60',
        isDragging && 'ring-2 ring-primary',
      )}
    >
      <GripVertical
        className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground"
        aria-hidden
      />
      <Checkbox
        checked={item.completed}
        onCheckedChange={() => toggle.mutate({itemId: item.id, completed: item.completed})}
        className="h-5 w-5"
      />
      <button
        type="button"
        onClick={() => onEdit(item)}
        className={cn('flex-1 text-left text-sm font-medium', item.completed && 'line-through')}
      >
        {item.title}
      </button>
      {metaLabel && <span className="text-xs text-muted-foreground">{metaLabel}</span>}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit(item)}
        className="h-7 w-7 opacity-0 group-hover:opacity-100"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
