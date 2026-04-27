export interface NativeSqliteDatabase {
  prepare(sql: string): NativeSqliteStatement
  exec(sql: string): unknown
  close(): void
}

export interface NativeSqliteStatement {
  all(...values: unknown[]): unknown[]
  get(...values: unknown[]): unknown
  run(...values: unknown[]): { changes: number; lastInsertRowid: unknown }
}

interface NativeSqliteDatabaseConstructor {
  new (path: string): NativeSqliteDatabase
}

type RuntimeImport = (specifier: string) => Promise<unknown>

const importRuntimeModule = Function('specifier', 'return import(specifier)') as RuntimeImport

const sqliteModule = await importRuntimeModule(isBunRuntime() ? 'bun:sqlite' : 'node:sqlite')
const NativeSqliteDatabaseConstructor = getNativeSqliteDatabaseConstructor(sqliteModule)

export function createNativeSqliteDatabase(path = ':memory:'): NativeSqliteDatabase {
  return new NativeSqliteDatabaseConstructor(path)
}

function isBunRuntime(): boolean {
  return 'Bun' in globalThis
}

function getNativeSqliteDatabaseConstructor(value: unknown): NativeSqliteDatabaseConstructor {
  if (!isRecord(value)) {
    throw new TypeError('SQLite module did not load')
  }

  let constructor = isBunRuntime() ? value.Database : value.DatabaseSync

  if (typeof constructor !== 'function') {
    throw new TypeError('SQLite database constructor did not load')
  }

  return constructor as NativeSqliteDatabaseConstructor
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
