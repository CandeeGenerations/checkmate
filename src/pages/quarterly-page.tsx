import {useState} from 'react'

import {ExportPdfButton} from '@/components/export-pdf-button'
import {ItemDialog} from '@/components/item-dialog'
import {SortableFlatList} from '@/components/sortable-flat-list'
import {Spinner} from '@/components/ui/spinner'
import {usePeriod} from '@/hooks/use-period'
import type {Item} from '@/lib/api'
import {formatDateLabel, todayISO} from '@/lib/date'

const MONTH_OF_QUARTER = ['1st', '2nd', '3rd']

export function QuarterlyPage() {
  const date = todayISO()
  const {data, isLoading} = usePeriod('quarterly', date)
  const [editing, setEditing] = useState<Item | null>(null)

  const sorted = [...(data?.items ?? [])].sort((a, b) => {
    const aMq = a.monthOfQuarter ?? -1
    const bMq = b.monthOfQuarter ?? -1
    if (aMq !== bMq) return aMq - bMq
    const aDay = a.dayOfMonth ?? -1
    const bDay = b.dayOfMonth ?? -1
    if (aDay !== bDay) return aDay - bDay
    return a.sortOrder - b.sortOrder
  })

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-tight">This quarter</h2>
          <p className="text-sm text-muted-foreground">
            {data && `${formatDateLabel(data.range.startISO)} – ${formatDateLabel(data.range.endISO)}`}
          </p>
        </div>
        <ExportPdfButton view={data} />
      </div>

      {isLoading && <Spinner />}

      {data && data.items.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No quarterly items yet.
        </p>
      )}

      <SortableFlatList
        items={sorted}
        frequency="quarterly"
        date={date}
        onEdit={setEditing}
        metaLabel={(it) =>
          it.monthOfQuarter == null || it.dayOfMonth == null
            ? 'Any time'
            : `${MONTH_OF_QUARTER[it.monthOfQuarter - 1]} month, day ${it.dayOfMonth}`
        }
      />

      <ItemDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing} />
    </div>
  )
}
