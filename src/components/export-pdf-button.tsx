import {Printer} from 'lucide-react'
import {toast} from 'sonner'

import {Button} from '@/components/ui/button'
import type {PeriodView} from '@/lib/api'
import {exportPeriodPdf} from '@/lib/pdf'

export function ExportPdfButton({view}: {view: PeriodView | undefined}) {
  function handleClick() {
    if (!view) return
    try {
      exportPeriodPdf(view)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF export failed')
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={!view} className="gap-1">
      <Printer className="h-4 w-4" />
      Export PDF
    </Button>
  )
}
