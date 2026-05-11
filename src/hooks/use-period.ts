import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {completeItem, fetchPeriod, type PeriodView, uncompleteItem} from '@/lib/api'
import type {Frequency} from '@/lib/date'

export function periodKey(frequency: Frequency, date: string) {
  return ['period', frequency, date] as const
}

export function usePeriod(frequency: Frequency, date: string) {
  return useQuery({queryKey: periodKey(frequency, date), queryFn: () => fetchPeriod(frequency, date)})
}

export function useToggleCompletion(frequency: Frequency, date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({itemId, completed}: {itemId: number; completed: boolean}) =>
      completed ? uncompleteItem(itemId, date) : completeItem(itemId, date),
    onMutate: async ({itemId, completed}) => {
      await qc.cancelQueries({queryKey: periodKey(frequency, date)})
      const prev = qc.getQueryData<PeriodView>(periodKey(frequency, date))
      if (prev) {
        qc.setQueryData<PeriodView>(periodKey(frequency, date), {
          ...prev,
          items: prev.items.map((it) => (it.id === itemId ? {...it, completed: !completed} : it)),
        })
      }
      return {prev}
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(periodKey(frequency, date), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({queryKey: ['period']})
    },
  })
}
