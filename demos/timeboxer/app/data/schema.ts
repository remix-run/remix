import { column as c, table, type TableRow } from 'remix/data-table'

export const users = table({
  name: 'users',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    username: c.text().notNull().unique(),
    created_at: c.integer().notNull(),
  },
})

export const userPasswords = table({
  name: 'user_passwords',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    user_id: c
      .integer()
      .notNull()
      .unique()
      .references('users', 'id', 'user_passwords_user_id_fk')
      .onDelete('cascade'),
    password_hash: c.text().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
})

export const schedules = table({
  name: 'schedules',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    user_id: c
      .integer()
      .notNull()
      .references('users', 'id', 'schedules_user_id_fk')
      .onDelete('cascade'),
    name: c.text().notNull(),
    revision: c.integer().notNull(),
    status: c.text().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
})

export const scheduleBlocks = table({
  name: 'schedule_blocks',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    client_id: c.text().notNull(),
    schedule_id: c
      .integer()
      .notNull()
      .references('schedules', 'id', 'schedule_blocks_schedule_id_fk')
      .onDelete('cascade'),
    name: c.text().notNull(),
    color: c.text().nullable(),
    day_of_week: c.integer().notNull(),
    start_minute: c.integer().notNull(),
    end_minute: c.integer().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
})

export type User = TableRow<typeof users>
export type UserPassword = TableRow<typeof userPasswords>
export type Schedule = TableRow<typeof schedules>
export type ScheduleBlock = TableRow<typeof scheduleBlocks>
