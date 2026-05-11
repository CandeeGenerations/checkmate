import {CategorySectionHeader} from '@/components/category-section-header'
import {SortableFlatList} from '@/components/sortable-flat-list'
import {useCategories} from '@/hooks/use-categories'
import {useSectionCollapse} from '@/hooks/use-section-collapse'
import type {PeriodItem} from '@/lib/api'
import {groupBySection} from '@/lib/categories'
import type {Frequency} from '@/lib/date'

interface SectionedFlatListProps {
  /** Pre-sorted items (date / day-field sort applied by the page). Sections are derived from
   *  this list, preserving the input order within each Category. */
  items: PeriodItem[]
  /** The view's frequency — used for completion toggling and as the localStorage view key. */
  frequency: Frequency
  date: string
  onEdit: (item: PeriodItem) => void
  metaLabel?: (item: PeriodItem) => string | undefined
}

export function SectionedFlatList({items, frequency, date, onEdit, metaLabel}: SectionedFlatListProps) {
  const {data: categories = []} = useCategories()
  const sections = groupBySection(items, categories)

  if (sections.length === 0) return null

  // If there are no named Categories in use here AND no Uncategorized items either, render nothing.
  // If the only section is Uncategorized, render the bare list with no header — keeps the pre-Category
  // look for users who haven't adopted Categories.
  const namedSections = sections.filter((s) => s.category != null)
  if (namedSections.length === 0) {
    return <SortableFlatList items={items} frequency={frequency} date={date} onEdit={onEdit} metaLabel={metaLabel} />
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <Section
          key={section.category?.id ?? 'uncategorized'}
          section={section}
          frequency={frequency}
          date={date}
          onEdit={onEdit}
          metaLabel={metaLabel}
        />
      ))}
    </div>
  )
}

function Section({
  section,
  frequency,
  date,
  onEdit,
  metaLabel,
}: {
  section: ReturnType<typeof groupBySection>[number]
  frequency: Frequency
  date: string
  onEdit: (item: PeriodItem) => void
  metaLabel?: (item: PeriodItem) => string | undefined
}) {
  const [collapsed] = useSectionCollapse(frequency, section.category?.id ?? null)
  return (
    <div className="space-y-2">
      <CategorySectionHeader category={section.category} view={frequency} count={section.items.length} />
      {!collapsed && (
        <SortableFlatList items={section.items} frequency={frequency} date={date} onEdit={onEdit} metaLabel={metaLabel} />
      )}
    </div>
  )
}
