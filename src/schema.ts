import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const postedLeads = sqliteTable('posted_leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').notNull().unique(),
  title: text('title').notNull(),
  postedAt: integer('posted_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
