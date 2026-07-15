import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

import type { Database } from './lib/database.ts'
import type { Migrator } from './lib/migrations.ts'

type DbModule = {
  db: Database
  migrator: Migrator
  seed?: (db: Database) => Promise<void>
}

type DbCommandOptions = {
  argv?: string[]
  cwd?: string
}

export async function create(options: DbCommandOptions = {}): Promise<number> {
  let { db } = await loadDbModule(options.cwd)
  await db.create()
  return 0
}

export async function drop(options: DbCommandOptions = {}): Promise<number> {
  let { db } = await loadDbModule(options.cwd)
  await db.drop()
  return 0
}

export async function migrate(options: DbCommandOptions = {}): Promise<number> {
  let argv = options.argv ?? []
  let { db, migrator } = await loadDbModule(options.cwd)
  await migrator.migrate(db, parseMigrateOptions(argv))
  return 0
}

export async function reset(options: DbCommandOptions = {}): Promise<number> {
  let { db, migrator, seed } = await loadDbModule(options.cwd)
  await migrator.reset(db, { seed })
  return 0
}

export async function seed(options: DbCommandOptions = {}): Promise<number> {
  let { db, seed: seedDatabase } = await loadDbModule(options.cwd)

  if (!seedDatabase) {
    throw new Error('app/db.ts must export a seed function to run db seed')
  }

  await seedDatabase(db)
  return 0
}

export async function status(options: DbCommandOptions = {}): Promise<number> {
  let { db, migrator } = await loadDbModule(options.cwd)
  let entries = await migrator.status(db)

  for (let entry of entries) {
    console.log(entry.id + ' ' + entry.name + ' ' + entry.status)
  }

  return 0
}

async function loadDbModule(cwd = process.cwd()): Promise<DbModule> {
  let moduleUrl = pathToFileURL(resolve(cwd, 'app/db.ts')).href
  let mod = (await import(moduleUrl)) as Partial<DbModule>

  if (!mod.db) {
    throw new Error('app/db.ts must export db')
  }

  if (!mod.migrator) {
    throw new Error('app/db.ts must export migrator')
  }

  return mod as DbModule
}

function parseMigrateOptions(argv: string[]): { to?: string } {
  let toIndex = argv.indexOf('--to')

  if (toIndex === -1) {
    return {}
  }

  let to = argv[toIndex + 1]

  if (!to) {
    throw new Error('Missing value for --to')
  }

  return { to }
}
