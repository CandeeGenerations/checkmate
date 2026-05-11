import {Button} from '@/components/ui/button'
import {useSectionCollapse} from '@/hooks/use-section-collapse'
import type {Category} from '@/lib/api'
import {CATEGORY_COLOR_CLASSES, isColorToken} from '@/lib/categories'
import {cn} from '@/lib/utils'
import {ChevronDown, ChevronRight, Pencil} from 'lucide-react'

import {CategoryEditPopover} from './category-edit-popover'

interface CategorySectionHeaderProps {
  /** null = Uncategorized header (no edit affordance, no color). */
  category: Category | null
  /** Stable string identifying the current view, e.g. 'daily', 'monthly', 'weekly:0'. */
  view: string
  count: number
  /** Optional drag handle, supplied by parent (sortable section reordering). */
  dragHandle?: React.ReactNode
  /** Variant: 'flat' for full-width pages, 'compact' for kanban columns. */
  variant?: 'flat' | 'compact'
}

export function CategorySectionHeader({
  category,
  view,
  count,
  dragHandle,
  variant = 'flat',
}: CategorySectionHeaderProps) {
  const [collapsed, toggle] = useSectionCollapse(view, category?.id ?? null)
  const Chevron = collapsed ? ChevronRight : ChevronDown

  const colorClasses = category?.color && isColorToken(category.color) ? CATEGORY_COLOR_CLASSES[category.color] : null

  return (
    <div
      className={cn(
        // `select-none` + `[-webkit-touch-callout:none]` stop the iOS/Android long-press
        // gesture from starting a text selection or popping the callout menu when the
        // user is trying to drag the header.
        'flex items-center gap-1.5 transition-colors select-none [-webkit-touch-callout:none]',
        // Flat: bleed to screen edges on mobile with only top/bottom borders (matching the
        // item-row pattern in sortable-item-row.tsx); revert to card-style at sm+.
        // Compact (kanban columns): always card-style, no bleed.
        variant === 'flat'
          ? '-mx-4 border-y px-4 py-1.5 sm:mx-0 sm:rounded-md sm:border sm:px-2'
          : 'rounded-md border px-1.5 py-1',
        colorClasses?.headerBg ?? 'bg-muted/40',
      )}
    >
      {dragHandle}
      <button
        type="button"
        onClick={toggle}
        className="flex flex-1 items-center gap-1.5 text-left"
        aria-expanded={!collapsed}
      >
        <Chevron className={cn('shrink-0 text-muted-foreground', variant === 'flat' ? 'h-4 w-4' : 'h-3 w-3')} />
        {category?.icon && (
          <span className={cn('shrink-0', variant === 'flat' ? 'text-base' : 'text-sm')}>{category.icon}</span>
        )}
        <span
          className={cn(
            'truncate font-semibold uppercase tracking-wider',
            variant === 'flat' ? 'text-xs' : 'text-[10px]',
            colorClasses?.headerText ?? 'text-muted-foreground',
          )}
        >
          {category?.name ?? 'Uncategorized'}
        </span>
        <span
          className={cn(
            'ml-1 shrink-0 rounded-full px-1.5 text-[10px] font-medium tabular-nums',
            'bg-background/70 text-muted-foreground',
          )}
        >
          {count}
        </span>
      </button>
      {category && variant === 'flat' && (
        <CategoryEditPopover category={category}>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3 w-3" />
          </Button>
        </CategoryEditPopover>
      )}
    </div>
  )
}
