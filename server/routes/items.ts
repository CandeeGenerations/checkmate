import type {Request, Response} from 'express'
import {Router} from 'express'
import {asc, eq, max} from 'drizzle-orm'

import {db} from '../db/index.js'
import {items} from '../db/schema.js'
import type {Frequency} from '../lib/date.js'

export const itemsRouter = Router()

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly']

interface ItemPayload {
  title?: unknown
  frequency?: unknown
  dayOfWeek?: unknown
  dayOfMonth?: unknown
  monthOfQuarter?: unknown
}

interface NormalizedItem {
  title: string
  frequency: Frequency
  dayOfWeek: number | null
  dayOfMonth: number | null
  monthOfQuarter: number | null
}

function normalize(payload: ItemPayload): NormalizedItem | {error: string} {
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
    if (haveMonth !== haveDay) return {error: 'Quarterly assignment needs both monthOfQuarter and dayOfMonth, or neither'}
    if (haveMonth && haveDay) {
      const mq = Number(payload.monthOfQuarter)
      const d = Number(payload.dayOfMonth)
      if (!Number.isInteger(mq) || mq < 1 || mq > 3) return {error: 'monthOfQuarter must be 1–3'}
      if (!Number.isInteger(d) || d < 1 || d > 31) return {error: 'dayOfMonth must be 1–31'}
      monthOfQuarter = mq
      dayOfMonth = d
    }
  }

  return {title, frequency, dayOfWeek, dayOfMonth, monthOfQuarter}
}

async function nextSortOrder(frequency: Frequency): Promise<number> {
  const [row] = await db.select({m: max(items.sortOrder)}).from(items).where(eq(items.frequency, frequency))
  return (row?.m ?? 0) + 1
}

itemsRouter.get('/', async (_req, res) => {
  const all = await db.select().from(items).orderBy(asc(items.frequency), asc(items.sortOrder), asc(items.id))
  res.json(all)
})

itemsRouter.post('/', async (req, res) => {
  const norm = normalize(req.body)
  if ('error' in norm) {
    res.status(400).json({error: norm.error})
    return
  }
  const sortOrder = await nextSortOrder(norm.frequency)
  const [created] = await db.insert(items).values({...norm, sortOrder}).returning()
  res.status(201).json(created)
})

itemsRouter.put('/reorder', async (req, res) => {
  const rows: unknown = req.body?.items
  if (!Array.isArray(rows)) {
    res.status(400).json({error: 'items array required'})
    return
  }
  const updates: Array<{id: number; frequency: Frequency; sortOrder: number; dayOfWeek?: number | null}> = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const obj = r as Record<string, unknown>
    const id = Number(obj.id)
    const sortOrder = Number(obj.sortOrder)
    const frequency = obj.frequency as Frequency
    if (!Number.isInteger(id) || !Number.isInteger(sortOrder) || !FREQUENCIES.includes(frequency)) continue
    const upd: {id: number; frequency: Frequency; sortOrder: number; dayOfWeek?: number | null} = {
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
    updates.push(upd)
  }
  const now = new Date().toISOString()
  for (const u of updates) {
    const set: Record<string, unknown> = {sortOrder: u.sortOrder, frequency: u.frequency, updatedAt: now}
    if ('dayOfWeek' in u) set.dayOfWeek = u.dayOfWeek
    await db.update(items).set(set).where(eq(items.id, u.id))
  }
  res.json({success: true})
})

itemsRouter.put('/:id', async (req: Request, res: Response) => {
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
  const norm = normalize(req.body)
  if ('error' in norm) {
    res.status(400).json({error: norm.error})
    return
  }
  // If frequency changed, place at the end of the new bucket and clear day fields not honored above.
  const sortOrder = norm.frequency === existing.frequency ? existing.sortOrder : await nextSortOrder(norm.frequency)
  const [updated] = await db
    .update(items)
    .set({...norm, sortOrder, updatedAt: new Date().toISOString()})
    .where(eq(items.id, id))
    .returning()
  res.json(updated)
})

itemsRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({error: 'Invalid id'})
    return
  }
  await db.delete(items).where(eq(items.id, id))
  res.json({success: true})
})

