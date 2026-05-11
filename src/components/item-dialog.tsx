import {useState} from 'react'
import {toast} from 'sonner'

import {CategoryCombobox} from '@/components/category-combobox'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {useCreateItem, useDeleteItem, useUpdateItem} from '@/hooks/use-items'
import type {Item, ItemInput} from '@/lib/api'
import type {Frequency} from '@/lib/date'

interface ItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: Item | null
  /** Default frequency when creating a new item (ignored when editing). */
  defaultFrequency?: Frequency
}

const FREQUENCY_OPTIONS: Array<{value: Frequency; label: string}> = [
  {value: 'daily', label: 'Daily'},
  {value: 'weekly', label: 'Weekly'},
  {value: 'monthly', label: 'Monthly'},
  {value: 'quarterly', label: 'Quarterly'},
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function ItemDialog({open, onOpenChange, initial, defaultFrequency = 'daily'}: ItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <ItemForm
          key={initial?.id ?? `new-${defaultFrequency}`}
          initial={initial ?? null}
          defaultFrequency={defaultFrequency}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function ItemForm({
  initial,
  defaultFrequency,
  onClose,
}: {
  initial: Item | null
  defaultFrequency: Frequency
  onClose: () => void
}) {
  const isEdit = !!initial
  const [title, setTitle] = useState(initial?.title ?? '')
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? defaultFrequency)
  const [dayOfWeek, setDayOfWeek] = useState<string>(initial?.dayOfWeek == null ? '' : String(initial.dayOfWeek))
  const [dayOfMonth, setDayOfMonth] = useState<string>(initial?.dayOfMonth == null ? '' : String(initial.dayOfMonth))
  const [monthOfQuarter, setMonthOfQuarter] = useState<string>(
    initial?.monthOfQuarter == null ? '' : String(initial.monthOfQuarter),
  )
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null)

  const create = useCreateItem()
  const update = useUpdateItem()
  const del = useDeleteItem()

  function buildInput(): ItemInput | {error: string} {
    const t = title.trim()
    if (!t) return {error: 'Title is required'}
    const input: ItemInput = {title: t, frequency, categoryId}
    if (frequency === 'weekly' && dayOfWeek !== '') input.dayOfWeek = Number(dayOfWeek)
    if (frequency === 'monthly' && dayOfMonth !== '') input.dayOfMonth = Number(dayOfMonth)
    if (frequency === 'quarterly') {
      const haveBoth = monthOfQuarter !== '' && dayOfMonth !== ''
      const haveNone = monthOfQuarter === '' && dayOfMonth === ''
      if (!haveBoth && !haveNone) return {error: 'Quarterly assignment needs both month and day, or leave both empty'}
      if (haveBoth) {
        input.monthOfQuarter = Number(monthOfQuarter)
        input.dayOfMonth = Number(dayOfMonth)
      }
    }
    return input
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const built = buildInput()
    if ('error' in built) {
      toast.error(built.error)
      return
    }
    try {
      if (isEdit && initial) {
        await update.mutateAsync({id: initial.id, input: built})
        toast.success('Item updated')
      } else {
        await create.mutateAsync(built)
        toast.success('Item added')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function handleDelete() {
    if (!initial) return
    if (!confirm(`Delete "${initial.title}"? This will remove all of its completion history.`)) return
    try {
      await del.mutateAsync(initial.id)
      toast.success('Item deleted')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit item' : 'New item'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Adjust this recurring item.' : 'Add a recurring item to your list.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Take out trash" />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <CategoryCombobox value={categoryId} onChange={setCategoryId} />
          </div>

          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {frequency === 'weekly' && (
            <div className="space-y-1.5">
              <Label>Day of week</Label>
              <Select value={dayOfWeek || 'none'} onValueChange={(v) => setDayOfWeek(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned (any day this week)</SelectItem>
                  {WEEKDAYS.map((label, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {frequency === 'monthly' && (
            <div className="space-y-1.5">
              <Label>Day of month</Label>
              <Select value={dayOfMonth || 'none'} onValueChange={(v) => setDayOfMonth(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned (any day this month)</SelectItem>
                  {Array.from({length: 31}, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Day {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Days past the end of a short month clamp to the last day.</p>
            </div>
          )}

          {frequency === 'quarterly' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month of quarter</Label>
                <Select value={monthOfQuarter || 'none'} onValueChange={(v) => setMonthOfQuarter(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    <SelectItem value="1">1st month</SelectItem>
                    <SelectItem value="2">2nd month</SelectItem>
                    <SelectItem value="3">3rd month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Day of month</Label>
                <Select value={dayOfMonth || 'none'} onValueChange={(v) => setDayOfMonth(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {Array.from({length: 31}, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        Day {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="flex-row justify-between sm:justify-between">
            {isEdit ? (
              <Button type="button" variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive">
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {isEdit ? 'Save' : 'Add'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
  )
}
