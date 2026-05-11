import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {createItem, deleteItem, fetchItems, type ItemInput, reorderItems, type ReorderItemRow, updateItem} from '@/lib/api'

export const ITEMS_KEY = ['items'] as const

export function useItems() {
  return useQuery({queryKey: ITEMS_KEY, queryFn: fetchItems})
}

function useInvalidateAll() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({queryKey: ITEMS_KEY})
    qc.invalidateQueries({queryKey: ['period']})
  }
}

export function useCreateItem() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: ItemInput) => createItem(input),
    onSuccess: invalidate,
  })
}

export function useUpdateItem() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({id, input}: {id: number; input: ItemInput}) => updateItem(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteItem() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id: number) => deleteItem(id),
    onSuccess: invalidate,
  })
}

export function useReorderItems() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (rows: ReorderItemRow[]) => reorderItems(rows),
    onSuccess: invalidate,
  })
}
