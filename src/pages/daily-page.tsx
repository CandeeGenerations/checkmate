import {useState} from 'react'

import {ExportPdfButton} from '@/components/export-pdf-button'
import {ItemDialog} from '@/components/item-dialog'
import {SortableFlatList} from '@/components/sortable-flat-list'
import {Spinner} from '@/components/ui/spinner'
import {usePeriod} from '@/hooks/use-period'
import type {Item, PeriodItem} from '@/lib/api'
import {formatDayLabel, todayISO} from '@/lib/date'

const FREQ_LABEL: Record<PeriodItem['frequency'], string> = {
  daily: '',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

export function DailyPage() {
  const date = todayISO()
  const {data, isLoading} = usePeriod('daily', date)
  const [editing, setEditing] = useState<Item | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-tight">Today</h2>
          <p className="text-sm text-muted-foreground">{formatDayLabel(date)}</p>
        </div>
        <ExportPdfButton view={data} />
      </div>

      {isLoading && <Spinner />}

      {data && data.items.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing on the agenda today. Add a daily item, or assign a weekly/monthly/quarterly item to today.
        </p>
      )}

      <SortableFlatList
        items={data?.items ?? []}
        frequency="daily"
        date={date}
        onEdit={setEditing}
        metaLabel={(it) => FREQ_LABEL[it.frequency] || undefined}
      />

      <ItemDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing} />
    </div>
  )
}
