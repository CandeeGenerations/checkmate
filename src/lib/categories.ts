import type {Category, PeriodItem} from './api'

// Data-stable category color tokens. Tailwind class strings are written out literally so JIT
// detects them. Adding a token here also requires extending the swatch grid in the editor.
export const CATEGORY_COLOR_TOKENS = ['red', 'orange', 'amber', 'emerald', 'sky', 'blue', 'violet', 'rose'] as const
export type CategoryColorToken = (typeof CATEGORY_COLOR_TOKENS)[number]

interface ColorClasses {
  /** Section header background tint. */
  headerBg: string
  /** Section header text color when needed. */
  headerText: string
  /** Small swatch (for the picker grid and chips). */
  swatch: string
  /** Subtle ring around the section block. */
  ring: string
}

export const CATEGORY_COLOR_CLASSES: Record<CategoryColorToken, ColorClasses> = {
  red: {headerBg: 'bg-red-100/60', headerText: 'text-red-900', swatch: 'bg-red-400', ring: 'ring-red-200'},
  orange: {headerBg: 'bg-orange-100/60', headerText: 'text-orange-900', swatch: 'bg-orange-400', ring: 'ring-orange-200'},
  amber: {headerBg: 'bg-amber-100/60', headerText: 'text-amber-900', swatch: 'bg-amber-400', ring: 'ring-amber-200'},
  emerald: {headerBg: 'bg-emerald-100/60', headerText: 'text-emerald-900', swatch: 'bg-emerald-400', ring: 'ring-emerald-200'},
  sky: {headerBg: 'bg-sky-100/60', headerText: 'text-sky-900', swatch: 'bg-sky-400', ring: 'ring-sky-200'},
  blue: {headerBg: 'bg-blue-100/60', headerText: 'text-blue-900', swatch: 'bg-blue-400', ring: 'ring-blue-200'},
  violet: {headerBg: 'bg-violet-100/60', headerText: 'text-violet-900', swatch: 'bg-violet-400', ring: 'ring-violet-200'},
  rose: {headerBg: 'bg-rose-100/60', headerText: 'text-rose-900', swatch: 'bg-rose-400', ring: 'ring-rose-200'},
}

export function isColorToken(value: unknown): value is CategoryColorToken {
  return typeof value === 'string' && (CATEGORY_COLOR_TOKENS as readonly string[]).includes(value)
}

export interface CategorySection<T extends PeriodItem = PeriodItem> {
  category: Category | null
  items: T[]
}

/**
 * Group a list of items into sections by Category.
 *
 * Order: Uncategorized first (always — even if empty? no: only if it has items, otherwise the
 * section is hidden entirely), then named Categories in their sortOrder.
 * Categories with no items in this list are omitted entirely (per CONTEXT.md: empty Categories
 * don't take up space in views they aren't used in).
 */
export function groupBySection<T extends PeriodItem>(items: T[], categories: Category[]): CategorySection<T>[] {
  const byId = new Map<number | null, T[]>()
  for (const it of items) {
    const key = it.categoryId ?? null
    const arr = byId.get(key) ?? []
    arr.push(it)
    byId.set(key, arr)
  }
  const out: CategorySection<T>[] = []
  const uncategorized = byId.get(null)
  if (uncategorized && uncategorized.length > 0) out.push({category: null, items: uncategorized})
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  for (const cat of sortedCategories) {
    const arr = byId.get(cat.id)
    if (arr && arr.length > 0) out.push({category: cat, items: arr})
  }
  return out
}
