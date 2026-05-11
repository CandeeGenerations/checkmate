import {sql} from 'drizzle-orm'
import {index, integer, sqliteTable, text, uniqueIndex} from 'drizzle-orm/sqlite-core'

export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({autoIncrement: true}),
    name: text('name').notNull(),
    color: text('color'),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [uniqueIndex('categories_name_lower_idx').on(sql`lower(${table.name})`)],
)

export const items = sqliteTable(
  'items',
  {
    id: integer('id').primaryKey({autoIncrement: true}),
    title: text('title').notNull(),
    frequency: text('frequency', {enum: ['daily', 'weekly', 'monthly', 'quarterly']}).notNull().default('daily'),
    // Weekly assigned day: 0 = Sun … 6 = Sat. Null = floats within the week.
    dayOfWeek: integer('day_of_week'),
    // Monthly: 1–31. Quarterly also uses this together with monthOfQuarter. Null = floats.
    dayOfMonth: integer('day_of_month'),
    // Quarterly: 1–3 (which month within the quarter). Null = floats.
    monthOfQuarter: integer('month_of_quarter'),
    // Optional Category. Deleting a Category sets this to null (Item becomes Uncategorized).
    categoryId: integer('category_id').references(() => categories.id, {onDelete: 'set null'}),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index('items_frequency_idx').on(table.frequency),
    index('items_category_idx').on(table.categoryId),
  ],
)

export const completions = sqliteTable(
  'completions',
  {
    id: integer('id').primaryKey({autoIncrement: true}),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id, {onDelete: 'cascade'}),
    completedDate: text('completed_date').notNull(),
    completedAt: text('completed_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index('completions_item_date_idx').on(table.itemId, table.completedDate)],
)

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})
