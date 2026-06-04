import { Miniflare } from 'miniflare'

export type TestD1Database = D1Database & {
  prepareCalls: number
  dispose(): Promise<void>
}

export async function createTestD1Database(): Promise<TestD1Database> {
  let miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("OK") } }',
    d1Databases: ['DB'],
    d1Persist: false,
  })
  let database = (await miniflare.getD1Database('DB')) as unknown as D1Database

  return new TestD1DatabaseWrapper(database, miniflare)
}

class TestD1DatabaseWrapper implements TestD1Database {
  prepareCalls = 0

  #database: D1Database
  #miniflare: Miniflare

  constructor(database: D1Database, miniflare: Miniflare) {
    this.#database = database
    this.#miniflare = miniflare
  }

  prepare(query: string): D1PreparedStatement {
    this.prepareCalls += 1
    return this.#database.prepare(query)
  }

  batch<row = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<row>[]> {
    return this.#database.batch<row>(statements)
  }

  exec(query: string): Promise<D1ExecResult> {
    return this.#database.exec(query)
  }

  withSession(constraintOrBookmark?: D1SessionBookmark | D1SessionConstraint): D1DatabaseSession {
    return this.#database.withSession(constraintOrBookmark)
  }

  dump(): Promise<ArrayBuffer> {
    return this.#database.dump()
  }

  async dispose(): Promise<void> {
    await this.#miniflare.dispose()
  }
}
