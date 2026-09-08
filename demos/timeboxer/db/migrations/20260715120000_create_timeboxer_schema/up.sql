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
