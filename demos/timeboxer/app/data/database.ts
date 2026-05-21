import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

const databasePath = process.env.DATABASE_URL ?? './db/timebox.sqlite'

mkdirSync(dirname(databasePath), { recursive: true })

const sqlite = new DatabaseSync(databasePath)
sqlite.exec('PRAGMA foreign_keys = ON')
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CONSTRAINT user_passwords_user_id_fk
      FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CONSTRAINT schedules_user_id_fk
      FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON DELETE CASCADE,
    CONSTRAINT schedules_user_id_name_unique
      UNIQUE (user_id, name)
  );

  CREATE INDEX IF NOT EXISTS schedules_user_id_idx
    ON schedules (user_id);
`)

const scheduleColumns = sqlite
  .prepare('PRAGMA table_info(schedules)')
  .all() as Array<{ name: string }>

if (!scheduleColumns.some((column) => column.name === 'revision')) {
  sqlite.exec('ALTER TABLE schedules ADD COLUMN revision INTEGER NOT NULL DEFAULT 0')
}

if (!scheduleColumns.some((column) => column.name === 'status')) {
  sqlite.exec("ALTER TABLE schedules ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
}

const scheduleBlockColumns = sqlite
  .prepare('PRAGMA table_info(schedule_blocks)')
  .all() as Array<{ name: string }>

const hasFlatScheduleBlocks = [
  'client_id',
  'day_of_week',
  'start_minute',
  'end_minute',
].every((columnName) =>
  scheduleBlockColumns.some((column) => column.name === columnName),
)

if (!hasFlatScheduleBlocks) {
  sqlite.exec(`
    DROP TABLE IF EXISTS schedule_block_instances;
    DROP TABLE IF EXISTS schedule_blocks;
  `)
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS schedule_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    schedule_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    day_of_week INTEGER NOT NULL,
    start_minute INTEGER NOT NULL,
    end_minute INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CONSTRAINT schedule_blocks_schedule_id_fk
      FOREIGN KEY (schedule_id)
      REFERENCES schedules (id)
      ON DELETE CASCADE,
    CONSTRAINT schedule_blocks_schedule_id_client_id_unique
      UNIQUE (schedule_id, client_id),
    CONSTRAINT schedule_blocks_day_check
      CHECK (day_of_week >= 0 AND day_of_week <= 6),
    CONSTRAINT schedule_blocks_time_check
      CHECK (
        start_minute >= 0 AND
        end_minute <= 1440 AND
        start_minute < end_minute
      )
  );

  CREATE INDEX IF NOT EXISTS schedule_blocks_schedule_id_idx
    ON schedule_blocks (schedule_id);

  CREATE INDEX IF NOT EXISTS schedule_blocks_schedule_day_idx
    ON schedule_blocks (schedule_id, day_of_week);
`)

export const db = createDatabase(createSqliteDatabaseAdapter(sqlite))
