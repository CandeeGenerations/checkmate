import {and, asc, eq, isNull, max} from 'drizzle-orm'
import type {Request, Response} from 'express'
import {Router} from 'express'

import {db} from '../db/index.js'
import {categories, items} from '../db/schema.js'
import {asyncHandler} from '../lib/asyncHandler.js'
import type {Frequency} from '../lib/date.js'

export const itemsRouter = Router()

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly']

interface ItemPayload {
  title?: unknown
  frequency?: unknown
  dayOfWeek?: unknown
  dayOfMonth?: unknown
  monthOfQuarter?: unknown
  categoryId?: unknown
}

interface NormalizedItem {
  title: string
  frequency: Frequency
  dayOfWeek: number | null
  dayOfMonth: number | null
  monthOfQuarter: number | null
  categoryId: number | null
}

async function normalize(payload: ItemPayload): Promise<NormalizedItem | {error: string}> {
  const title = typeof payload.title === 'string' ? payload.title.trim() : ''
  if (!title) return {error: 'Title is required'}

  const frequency = payload.frequency as Frequency
  if (!FREQUENCIES.includes(frequency)) return {error: 'Invalid frequency'}

  let dayOfWeek: number | null = null
  let dayOfMonth: number | null = null
  let monthOfQuarter: number | null = null

  if (frequency === 'weekly' && payload.dayOfWeek != null) {
    const n = Number(payload.dayOfWeek)
    if (!Number.isInteger(n) || n < 0 || n > 6) return {error: 'dayOfWeek must be 0–6'}
    dayOfWeek = n
  }
  if (frequency === 'monthly' && payload.dayOfMonth != null) {
    const n = Number(payload.dayOfMonth)
    if (!Number.isInteger(n) || n < 1 || n > 31) return {error: 'dayOfMonth must be 1–31'}
    dayOfMonth = n
  }
  if (frequency === 'quarterly') {
    const haveMonth = payload.monthOfQuarter != null
    const haveDay = payload.dayOfMonth != null
    if (haveMonth !== haveDay)
      return {error: 'Quarterly assignment needs both monthOfQuarter and dayOfMonth, or neither'}
    if (haveMonth && haveDay) {
      const mq = Number(payload.monthOfQuarter)
      const d = Number(payload.dayOfMonth)
      if (!Number.isInteger(mq) || mq < 1 || mq > 3) return {error: 'monthOfQuarter must be 1–3'}
      if (!Number.isInteger(d) || d < 1 || d > 31) return {error: 'dayOfMonth must be 1–31'}
      monthOfQuarter = mq
      dayOfMonth = d
    }
  }

  let categoryId: number | null = null
  if (payload.categoryId != null) {
    const cid = Number(payload.categoryId)
    if (!Number.isInteger(cid)) return {error: 'categoryId must be an integer'}
    const [cat] = await db.select({id: categories.id}).from(categories).where(eq(categories.id, cid)).limit(1)
    if (!cat) return {error: 'Category not found'}
    categoryId = cid
  }

  return {title, frequency, dayOfWeek, dayOfMonth, monthOfQuarter, categoryId}
}

// Next sort order *within a (frequency, category) bucket*.
// Categories now act as a second axis, so an item appended to "Kitchen" / monthly should not
// fight for ordering with items appended to "Yard" / monthly.
async function nextSortOrder(frequency: Frequency, categoryId: number | null): Promise<number> {
  const where =
    categoryId == null
      ? and(eq(items.frequency, frequency), isNull(items.categoryId))
      : and(eq(items.frequency, frequency), eq(items.categoryId, categoryId))
  const [row] = await db
    .select({m: max(items.sortOrder)})
    .from(items)
    .where(where)
  return (row?.m ?? 0) + 1
}

itemsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const all = await db.select().from(items).orderBy(asc(items.frequency), asc(items.sortOrder), asc(items.id))
    res.json(all)
  }),
)

itemsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const norm = await normalize(req.body)
    if ('error' in norm) {
      res.status(400).json({error: norm.error})
      return
    }
    const sortOrder = await nextSortOrder(norm.frequency, norm.categoryId)
    const [created] = await db
      .insert(items)
      .values({...norm, sortOrder})
      .returning()
    res.status(201).json(created)
  }),
)

itemsRouter.put(
  '/reorder',
  asyncHandler(async (req, res) => {
    const rows: unknown = req.body?.items
    if (!Array.isArray(rows)) {
      res.status(400).json({error: 'items array required'})
      return
    }
    // Each row may also carry a target categoryId (drag across sections) and/or dayOfWeek
    // (drag across day-columns in Weekly). Missing fields are left untouched.
    const updates: Array<{
      id: number
      frequency: Frequency
      sortOrder: number
      dayOfWeek?: number | null
      categoryId?: number | null
    }> = []
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue
      const obj = r as Record<string, unknown>
      const id = Number(obj.id)
      const sortOrder = Number(obj.sortOrder)
      const frequency = obj.frequency as Frequency
      if (!Number.isInteger(id) || !Number.isInteger(sortOrder) || !FREQUENCIES.includes(frequency)) continue
      const upd: {
        id: number
        frequency: Frequency
        sortOrder: number
        dayOfWeek?: number | null
        categoryId?: number | null
      } = {
        id,
        frequency,
        sortOrder,
      }
      if (frequency === 'weekly' && 'dayOfWeek' in obj) {
        const dow = obj.dayOfWeek
        if (dow == null) {
          upd.dayOfWeek = null
        } else {
          const n = Number(dow)
          if (Number.isInteger(n) && n >= 0 && n <= 6) upd.dayOfWeek = n
        }
      }
      if ('categoryId' in obj) {
        const cid = obj.categoryId
        if (cid == null) {
          upd.categoryId = null
        } else {
          const n = Number(cid)
          if (Number.isInteger(n)) upd.categoryId = n
        }
      }
      updates.push(upd)
    }
    const now = new Date().toISOString()
    for (const u of updates) {
      const set: Record<string, unknown> = {sortOrder: u.sortOrder, frequency: u.frequency, updatedAt: now}
      if ('dayOfWeek' in u) set.dayOfWeek = u.dayOfWeek
      if ('categoryId' in u) set.categoryId = u.categoryId
      await db.update(items).set(set).where(eq(items.id, u.id))
    }
    res.json({success: true})
  }),
)

itemsRouter.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      res.status(400).json({error: 'Invalid id'})
      return
    }
    const [existing] = await db.select().from(items).where(eq(items.id, id))
    if (!existing) {
      res.status(404).json({error: 'Item not found'})
      return
    }
    const norm = await normalize(req.body)
    if ('error' in norm) {
      res.status(400).json({error: norm.error})
      return
    }
    // If the (frequency, category) bucket changed, append to the end of the new bucket.
    const movedBucket = norm.frequency !== existing.frequency || norm.categoryId !== existing.categoryId
    const sortOrder = movedBucket ? await nextSortOrder(norm.frequency, norm.categoryId) : existing.sortOrder
    const [updated] = await db
      .update(items)
      .set({...norm, sortOrder, updatedAt: new Date().toISOString()})
      .where(eq(items.id, id))
      .returning()
    res.json(updated)
  }),
)

itemsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      res.status(400).json({error: 'Invalid id'})
      return
    }
    await db.delete(items).where(eq(items.id, id))
    res.json({success: true})
  }),
)
