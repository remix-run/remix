export type NativeSqliteDatabase = {
  prepare(sql: string): NativeSqliteStatement
  exec(sql: string): unknown
  close(): void
}

type NativeSqliteStatement = {
  all(...values: unknown[]): unknown[]
  get(...values: unknown[]): unknown
  run(...values: unknown[]): { changes: number; lastInsertRowid: unknown }
}

type NativeSqliteDatabaseConstructor = {
  new (path: string): NativeSqliteDatabase
}

const isBun = 'Bun' in globalThis
const NativeSqliteDatabaseConstructor: NativeSqliteDatabaseConstructor = isBun
  ? // @ts-expect-error TypeScript does not resolve Bun built-in modules in this repo yet.
    (await import('bun:sqlite')).Database
  : (await import('node:sqlite')).DatabaseSync

export function createNativeSqliteDatabase(path = ':memory:'): NativeSqliteDatabase {
  return new NativeSqliteDatabaseConstructor(path)
}
