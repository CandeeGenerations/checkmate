import {Router} from 'express'
import {and, eq, gte, lte} from 'drizzle-orm'

import {db} from '../db/index.js'
import {completions, items} from '../db/schema.js'
import {isValidISO, periodRange, todayISO} from '../lib/date.js'

export const completionsRouter = Router()

// POST /api/completions
// body: {itemId: number, date?: YYYY-MM-DD}
// Records (itemId, date) so the item shows as completed for whatever period contains `date`
// under its current frequency. Idempotent: a second call on the same day is a no-op.
completionsRouter.post('/', async (req, res) => {
  const itemId = Number(req.body?.itemId)
  const date = typeof req.body?.date === 'string' && isValidISO(req.body.date) ? req.body.date : todayISO()
  if (!Number.isInteger(itemId)) {
    res.status(400).json({error: 'itemId required'})
    return
  }
  const [item] = await db.select().from(items).where(eq(items.id, itemId))
  if (!item) {
    res.status(404).json({error: 'Item not found'})
    return
  }
  const {startISO, endISO} = periodRange(item.frequency, date)
  const existing = await db
    .select()
    .from(completions)
    .where(
      and(
        eq(completions.itemId, itemId),
        gte(completions.completedDate, startISO),
        lte(completions.completedDate, endISO),
      ),
    )
  if (existing.length > 0) {
    res.json({success: true, completion: existing[0]})
    return
  }
  const [created] = await db.insert(completions).values({itemId, completedDate: date}).returning()
  res.status(201).json({success: true, completion: created})
})

// DELETE /api/completions
// body: {itemId: number, date?: YYYY-MM-DD}
// Deletes any completion(s) for itemId in the period containing `date`.
completionsRouter.delete('/', async (req, res) => {
  const itemId = Number(req.body?.itemId)
  const date = typeof req.body?.date === 'string' && isValidISO(req.body.date) ? req.body.date : todayISO()
  if (!Number.isInteger(itemId)) {
    res.status(400).json({error: 'itemId required'})
    return
  }
  const [item] = await db.select().from(items).where(eq(items.id, itemId))
  if (!item) {
    res.status(404).json({error: 'Item not found'})
    return
  }
  const {startISO, endISO} = periodRange(item.frequency, date)
  await db
    .delete(completions)
    .where(
      and(
        eq(completions.itemId, itemId),
        gte(completions.completedDate, startISO),
        lte(completions.completedDate, endISO),
      ),
    )
  res.json({success: true})
})
