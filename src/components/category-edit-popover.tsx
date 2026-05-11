import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {useDeleteCategory, useUpdateCategory} from '@/hooks/use-categories'
import type {Category} from '@/lib/api'
import {fetchCategoryItemCount} from '@/lib/api'
import {CATEGORY_COLOR_CLASSES, CATEGORY_COLOR_TOKENS, type CategoryColorToken, isColorToken} from '@/lib/categories'
import {cn} from '@/lib/utils'
import {useState} from 'react'
import {toast} from 'sonner'

interface CategoryEditPopoverProps {
  category: Category
  /** Custom trigger (typically the section header's edit affordance). */
  children: React.ReactNode
}

export function CategoryEditPopover({category, children}: CategoryEditPopoverProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(category.name)
  const [icon, setIcon] = useState(category.icon ?? '')
  const [color, setColor] = useState<CategoryColorToken | null>(isColorToken(category.color) ? category.color : null)
  const [deleteCount, setDeleteCount] = useState<number | null>(null)

  const update = useUpdateCategory()
  const del = useDeleteCategory()

  // Re-sync local state when a different category is opened — `category` may change while the
  // component is mounted (different section header triggers different categories).
  const [prevId, setPrevId] = useState(category.id)
  if (category.id !== prevId) {
    setPrevId(category.id)
    setName(category.name)
    setIcon(category.icon ?? '')
    setColor(isColorToken(category.color) ? category.color : null)
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Name is required')
      return
    }
    try {
      await update.mutateAsync({
        id: category.id,
        input: {name: trimmed, icon: icon.trim() || null, color},
      })
      toast.success('Category updated')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function openDeleteConfirm() {
    try {
      const {count} = await fetchCategoryItemCount(category.id)
      setDeleteCount(count)
    } catch {
      setDeleteCount(0)
    }
  }

  async function handleDelete() {
    try {
      await del.mutateAsync(category.id)
      toast.success('Category deleted')
      setDeleteCount(null)
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <div className="space-y-1.5">
            <Label htmlFor={`cat-name-${category.id}`}>Name</Label>
            <Input
              id={`cat-name-${category.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`cat-icon-${category.id}`}>Emoji</Label>
            <Input
              id={`cat-icon-${category.id}`}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🍳"
              maxLength={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={cn(
                  'h-6 w-6 rounded-full ring-2 ring-offset-1 ring-offset-background transition',
                  color == null ? 'ring-foreground/60' : 'ring-transparent hover:ring-foreground/20',
                  'bg-muted text-muted-foreground text-[10px] flex items-center justify-center',
                )}
                aria-label="No color"
                title="No color"
              >
                ✕
              </button>
              {CATEGORY_COLOR_TOKENS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setColor(t)}
                  className={cn(
                    'h-6 w-6 rounded-full ring-2 ring-offset-1 ring-offset-background transition',
                    CATEGORY_COLOR_CLASSES[t].swatch,
                    color === t ? 'ring-foreground/60' : 'ring-transparent hover:ring-foreground/20',
                  )}
                  aria-label={`Color ${t}`}
                  title={t}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={openDeleteConfirm}
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={update.isPending}>
                Save
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={deleteCount != null} onOpenChange={(o) => !o && setDeleteCount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{category.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              {deleteCount === 0
                ? 'No items belong to this category — it will be removed.'
                : `This will move ${deleteCount} item${deleteCount === 1 ? '' : 's'} to Uncategorized.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteCount(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={del.isPending}>
              Delete category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
