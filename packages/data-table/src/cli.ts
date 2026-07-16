import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

import type { Database } from './lib/database.ts'
import type { GetMigrations, MigrateOptions, Seed } from './lib/migrations.ts'

type DbModule = {
  db: Database
  getMigrations: GetMigrations
  seed?: Seed
}

type DbCommandOptions = {
  argv?: string[]
  cwd?: string
}

export async function wipe(options: DbCommandOptions = {}): Promise<number> {
  let { db } = await loadDbModule(options.cwd)
  await db.wipe()
  return 0
}

export async function migrate(options: DbCommandOptions = {}): Promise<number> {
  let argv = options.argv ?? []
  let { db, getMigrations } = await loadDbModule(options.cwd)
  await db.migrate(await getMigrations(), parseMigrateOptions(argv))
  return 0
}

export async function reset(options: DbCommandOptions = {}): Promise<number> {
  let { db, getMigrations, seed } = await loadDbModule(options.cwd)
  await db.reset({ migrations: await getMigrations(), seed })
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
  let { db, getMigrations } = await loadDbModule(options.cwd)
  let entries = await db.migrationStatus(await getMigrations())

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

  if (!mod.getMigrations) {
    throw new Error('app/db.ts must export getMigrations')
  }

  return mod as DbModule
}

function parseMigrateOptions(argv: string[]): MigrateOptions {
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
