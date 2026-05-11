import {and, asc, eq, max, ne, sql} from 'drizzle-orm'
import type {Request, Response} from 'express'
import {Router} from 'express'

import {db} from '../db/index.js'
import {categories, items} from '../db/schema.js'

export const categoriesRouter = Router()

interface CategoryPayload {
  name?: unknown
  color?: unknown
  icon?: unknown
}

interface NormalizedCategory {
  name: string
  color: string | null
  icon: string | null
}

function normalize(payload: CategoryPayload): NormalizedCategory | {error: string} {
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (!name) return {error: 'Name is required'}
  if (name.length > 60) return {error: 'Name is too long (max 60 chars)'}

  const color = typeof payload.color === 'string' && payload.color.trim() ? payload.color.trim() : null
  const icon = typeof payload.icon === 'string' && payload.icon.trim() ? payload.icon.trim() : null

  return {name, color, icon}
}

async function nameTaken(name: string, exceptId?: number): Promise<boolean> {
  const lower = name.toLowerCase()
  const where =
    exceptId == null
      ? sql`lower(${categories.name}) = ${lower}`
      : and(sql`lower(${categories.name}) = ${lower}`, ne(categories.id, exceptId))
  const [row] = await db.select({id: categories.id}).from(categories).where(where).limit(1)
  return !!row
}

async function nextSortOrder(): Promise<number> {
  const [row] = await db.select({m: max(categories.sortOrder)}).from(categories)
  return (row?.m ?? 0) + 1
}

categoriesRouter.get('/', async (_req, res) => {
  const all = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id))
  res.json(all)
})

categoriesRouter.post('/', async (req, res) => {
  const norm = normalize(req.body)
  if ('error' in norm) {
    res.status(400).json({error: norm.error})
    return
  }
  if (await nameTaken(norm.name)) {
    res.status(409).json({error: 'A category with that name already exists'})
    return
  }
  const sortOrder = await nextSortOrder()
  const [created] = await db
    .insert(categories)
    .values({...norm, sortOrder})
    .returning()
  res.status(201).json(created)
})

categoriesRouter.put('/reorder', async (req, res) => {
  const rows: unknown = req.body?.categories
  if (!Array.isArray(rows)) {
    res.status(400).json({error: 'categories array required'})
    return
  }
  const updates: Array<{id: number; sortOrder: number}> = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const obj = r as Record<string, unknown>
    const id = Number(obj.id)
    const sortOrder = Number(obj.sortOrder)
    if (!Number.isInteger(id) || !Number.isInteger(sortOrder)) continue
    updates.push({id, sortOrder})
  }
  const now = new Date().toISOString()
  for (const u of updates) {
    await db.update(categories).set({sortOrder: u.sortOrder, updatedAt: now}).where(eq(categories.id, u.id))
  }
  res.json({success: true})
})

categoriesRouter.put('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({error: 'Invalid id'})
    return
  }
  const [existing] = await db.select().from(categories).where(eq(categories.id, id))
  if (!existing) {
    res.status(404).json({error: 'Category not found'})
    return
  }
  const norm = normalize(req.body)
  if ('error' in norm) {
    res.status(400).json({error: norm.error})
    return
  }
  if (await nameTaken(norm.name, id)) {
    res.status(409).json({error: 'A category with that name already exists'})
    return
  }
  const [updated] = await db
    .update(categories)
    .set({...norm, updatedAt: new Date().toISOString()})
    .where(eq(categories.id, id))
    .returning()
  res.json(updated)
})

categoriesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({error: 'Invalid id'})
    return
  }
  // ON DELETE SET NULL is declared on the Drizzle schema, but SQLite's ALTER TABLE ADD COLUMN
  // can't apply REFERENCES to an existing table — so the constraint isn't enforced at the DB
  // level for the migrated-in category_id column. Enforce it in the app instead: null-out
  // any items belonging to this category, then delete it.
  await db.update(items).set({categoryId: null, updatedAt: new Date().toISOString()}).where(eq(items.categoryId, id))
  await db.delete(categories).where(eq(categories.id, id))
  res.json({success: true})
})

// GET /api/categories/:id/item-count
// Used by the delete confirmation dialog: "This will move N item(s) to Uncategorized."
categoriesRouter.get('/:id/item-count', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({error: 'Invalid id'})
    return
  }
  const [row] = await db
    .select({count: sql<number>`count(*)`})
    .from(items)
    .where(eq(items.categoryId, id))
  res.json({count: row?.count ?? 0})
})
