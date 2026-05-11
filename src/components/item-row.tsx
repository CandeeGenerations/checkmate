import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {useToggleCompletion} from '@/hooks/use-period'
import type {PeriodItem} from '@/lib/api'
import type {Frequency} from '@/lib/date'
import {cn} from '@/lib/utils'
import {Pencil} from 'lucide-react'

interface ItemRowProps {
  item: PeriodItem
  /** Frequency of the *view* — drives which period query gets invalidated. */
  viewFrequency: Frequency
  date: string
  onEdit: (item: PeriodItem) => void
  /** Optional secondary label rendered to the right (e.g. "Tue", "the 15th"). */
  metaLabel?: string
}

export function ItemRow({item, viewFrequency, date, onEdit, metaLabel}: ItemRowProps) {
  const toggle = useToggleCompletion(viewFrequency, date)
  return (
    <div
      className={cn(
        // Mobile: edge-to-edge divider rows with no border/radius.
        // sm+: card-style with rounded border and white card bg.
        'group flex items-center gap-3 border-b bg-card/40 px-4 py-2.5 transition-colors',
        'sm:rounded-lg sm:border sm:bg-card sm:p-3',
        item.completed && 'opacity-60',
      )}
    >
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
      <Button variant="ghost" size="icon" onClick={() => onEdit(item)} className="opacity-0 group-hover:opacity-100">
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  )
}
