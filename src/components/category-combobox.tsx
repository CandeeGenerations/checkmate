import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {useCategories, useCreateCategory} from '@/hooks/use-categories'
import type {Category} from '@/lib/api'
import {CATEGORY_COLOR_CLASSES, isColorToken} from '@/lib/categories'
import {cn} from '@/lib/utils'
import {Check, ChevronDown, Plus, X} from 'lucide-react'
import {useMemo, useState} from 'react'
import {toast} from 'sonner'

interface CategoryComboboxProps {
  value: number | null
  onChange: (categoryId: number | null) => void
}

export function CategoryCombobox({value, onChange}: CategoryComboboxProps) {
  const {data: categories = []} = useCategories()
  const create = useCreateCategory()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(() => categories.find((c) => c.id === value) ?? null, [categories, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    if (!q) return sorted
    return sorted.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, query])

  const trimmedQuery = query.trim()
  const exactMatch = useMemo(
    () => categories.some((c) => c.name.toLowerCase() === trimmedQuery.toLowerCase()),
    [categories, trimmedQuery],
  )
  const canCreate = trimmedQuery.length > 0 && !exactMatch

  async function handleCreate() {
    if (!trimmedQuery) return
    try {
      const created = await create.mutateAsync({name: trimmedQuery})
      onChange(created.id)
      setQuery('')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed')
    }
  }

  function select(id: number | null) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between">
          <span className="flex min-w-0 items-center gap-2">
            {selected ? (
              <>
                {selected.icon && <span>{selected.icon}</span>}
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">No category</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) gap-2 p-2">
        <Input
          autoFocus
          placeholder="Search or create…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCreate) {
              e.preventDefault()
              handleCreate()
            }
          }}
        />
        <div className="max-h-60 overflow-y-auto">
          <button
            type="button"
            onClick={() => select(null)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
              value == null && 'bg-muted',
            )}
          >
            <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-muted-foreground">No category</span>
            {value == null && <Check className="h-4 w-4" />}
          </button>
          {filtered.map((cat) => (
            <CategoryOption key={cat.id} cat={cat} selected={cat.id === value} onSelect={() => select(cat.id)} />
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={create.isPending}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">
                Create &ldquo;<strong>{trimmedQuery}</strong>&rdquo;
              </span>
            </button>
          )}
          {!canCreate && filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No categories yet.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function CategoryOption({cat, selected, onSelect}: {cat: Category; selected: boolean; onSelect: () => void}) {
  const swatch = cat.color && isColorToken(cat.color) ? CATEGORY_COLOR_CLASSES[cat.color].swatch : null
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
        selected && 'bg-muted',
      )}
    >
      {swatch ? (
        <span className={cn('h-3 w-3 shrink-0 rounded-full', swatch)} />
      ) : (
        <span className="h-3 w-3 shrink-0 rounded-full border border-muted-foreground/30" />
      )}
      {cat.icon && <span>{cat.icon}</span>}
      <span className="flex-1 truncate">{cat.name}</span>
      {selected && <Check className="h-4 w-4" />}
    </button>
  )
}
