import {Router} from 'express'
import {asc, gte, inArray, lte, and} from 'drizzle-orm'

import {db} from '../db/index.js'
import {completions, items} from '../db/schema.js'
import type {Frequency} from '../lib/date.js'
import {dueDateInPeriod, isValidISO, periodRange, todayISO} from '../lib/date.js'

export const periodRouter = Router()

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly']

// GET /api/period/:frequency?date=YYYY-MM-DD
//
// Returns the items belonging to the requested view, augmented with their
// derived state for the period containing `date`:
//   - dueDate: ISO date the item is "due" in this period (after day-overflow clamp), or null if floating
//   - completed: whether any completion was logged inside this period
//
// For frequency === 'daily', this is the unified "today" agenda — daily items plus
// weekly/monthly/quarterly items whose dueDate equals today.
periodRouter.get('/:frequency', async (req, res) => {
  const frequency = req.params.frequency as Frequency
  if (!FREQUENCIES.includes(frequency)) {
    res.status(400).json({error: 'Invalid frequency'})
    return
  }
  const date =
    typeof req.query.date === 'string' && isValidISO(req.query.date) ? req.query.date : todayISO()

  // Pull all items first, then narrow. There won't be many — this is a personal app.
  const all = await db.select().from(items).orderBy(asc(items.sortOrder), asc(items.id))

  // Scope items to this view.
  const inView = all.filter((it) => {
    if (frequency === 'daily') {
      if (it.frequency === 'daily') return true
      const due = dueDateInPeriod(it, date)
      return due === date
    }
    return it.frequency === frequency
  })

  if (inView.length === 0) {
    res.json({frequency, date, range: periodRange(frequency, date), items: []})
    return
  }

  // For each item, find completions inside *its own* current period (which depends on its
  // frequency, not the view's frequency).
  const ids = inView.map((it) => it.id)
  // We could compute per-item ranges, but since periods overlap (today is inside this week,
  // this month, this quarter), a single fetch over the broadest range would work. Cleanest
  // and still cheap: one query over the unioned range and then filter in JS per item.
  const ranges = inView.map((it) => periodRange(it.frequency, date))
  const minStart = ranges.reduce((m, r) => (r.startISO < m ? r.startISO : m), ranges[0].startISO)
  const maxEnd = ranges.reduce((m, r) => (r.endISO > m ? r.endISO : m), ranges[0].endISO)
  const comps = await db
    .select()
    .from(completions)
    .where(
      and(
        inArray(completions.itemId, ids),
        gte(completions.completedDate, minStart),
        lte(completions.completedDate, maxEnd),
      ),
    )

  const byItem = new Map<number, string[]>()
  for (const c of comps) {
    const arr = byItem.get(c.itemId) ?? []
    arr.push(c.completedDate)
    byItem.set(c.itemId, arr)
  }

  const enriched = inView.map((it) => {
    const itemRange = periodRange(it.frequency, date)
    const dates = byItem.get(it.id) ?? []
    const completed = dates.some((d) => d >= itemRange.startISO && d <= itemRange.endISO)
    return {
      ...it,
      dueDate: dueDateInPeriod(it, date),
      completed,
    }
  })

  res.json({frequency, date, range: periodRange(frequency, date), items: enriched})
})
