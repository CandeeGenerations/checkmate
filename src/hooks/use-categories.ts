import {
  type CategoryInput,
  type ReorderCategoryRow,
  createCategory,
  deleteCategory,
  fetchCategories,
  fetchCategoryItemCount,
  reorderCategories,
  updateCategory,
} from '@/lib/api'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

export const CATEGORIES_KEY = ['categories'] as const

export function useCategories() {
  return useQuery({queryKey: CATEGORIES_KEY, queryFn: fetchCategories})
}

function useInvalidateAll() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({queryKey: CATEGORIES_KEY})
    qc.invalidateQueries({queryKey: ['items']})
    qc.invalidateQueries({queryKey: ['period']})
  }
}

export function useCreateCategory() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: CategoryInput) => createCategory(input),
    onSuccess: invalidate,
  })
}

export function useUpdateCategory() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({id, input}: {id: number; input: CategoryInput}) => updateCategory(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: invalidate,
  })
}

export function useReorderCategories() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (rows: ReorderCategoryRow[]) => reorderCategories(rows),
    onSuccess: invalidate,
  })
}

export function useCategoryItemCount(id: number | null) {
  return useQuery({
    queryKey: ['categories', id, 'item-count'],
    queryFn: () => fetchCategoryItemCount(id as number),
    enabled: id != null,
  })
}
