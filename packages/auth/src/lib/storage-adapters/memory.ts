import type { Storage, Where } from '../storage.ts'

/**
 * In-memory storage structure
 * Each model is stored as an array of records
 */
export interface MemoryDB {
  [model: string]: any[]
}

/**
 * Create an in-memory storage adapter for testing and demos
 *
 * This adapter stores all data in JavaScript arrays, making it fast and
 * easy to use for tests and demos without requiring a real database.
 *
 * @example
 * ```ts
 * import { createMemoryStorageAdapter } from '@remix-run/auth/storage-adapters/memory'
 *
 * let storage = createMemoryStorageAdapter()
 * let authClient = createAuthClient({ storage })
 * ```
 *
 * @example With shared storage
 * ```ts
 * let db: MemoryDB = {
 *   user: [],
 *   password: []
 * }
 *
 * let storage = createMemoryStorageAdapter(db)
 * // Can inspect db.user.length, etc. for testing
 * ```
 */
export function createMemoryStorageAdapter(db?: MemoryDB): Storage {
  let storage: MemoryDB = db || {
    user: [],
    password: [],
    oauthAccount: [],
    passwordResetToken: [],
  }

  function matchesWhere(record: any, where: Where[]): boolean {
    if (!where.length) return true

    let result = true
    for (let clause of where) {
      let value = record[clause.field]
      let matches = false

      switch (clause.operator || 'eq') {
        case 'eq':
          matches = value === clause.value
          break
        case 'ne':
          matches = value !== clause.value
          break
        case 'in':
          matches = Array.isArray(clause.value) && clause.value.includes(value)
          break
        case 'contains':
          matches = typeof value === 'string' && value.includes(clause.value)
          break
        case 'gt':
          matches = value > clause.value
          break
        case 'gte':
          matches = value >= clause.value
          break
        case 'lt':
          matches = value < clause.value
          break
        case 'lte':
          matches = value <= clause.value
          break
      }

      if (clause.connector === 'OR') {
        result = result || matches
      } else {
        // AND by default
        result = result && matches
      }
    }

    return result
  }

  return {
    async findOne({ model, where }) {
      let table = storage[model]
      if (!table) return null

      for (let record of table) {
        if (matchesWhere(record, where)) {
          return record
        }
      }
      return null
    },

    async findMany({ model, where = [], limit, offset }) {
      let table = storage[model]
      if (!table) return []

      let results = table.filter((record) => matchesWhere(record, where))

      if (offset !== undefined) {
        results = results.slice(offset)
      }
      if (limit !== undefined) {
        results = results.slice(0, limit)
      }

      return results
    },

    async create<T = any>({
      model,
      data,
    }: {
      model: string
      data: Record<string, any>
    }): Promise<T> {
      let table = storage[model]
      if (!table) {
        table = []
        storage[model] = table
      }

      // Generate ID if not provided and if this looks like a primary model
      if (!data.id && model === 'user') {
        data.id = crypto.randomUUID()
      }

      table.push(data)
      return data as T
    },

    async update({ model, where, data }) {
      let table = storage[model]
      if (!table) throw new Error(`Model ${model} not found`)

      for (let i = 0; i < table.length; i++) {
        if (matchesWhere(table[i], where)) {
          let updated = { ...table[i], ...data }
          table[i] = updated
          return updated
        }
      }

      throw new Error('Record not found for update')
    },

    async delete({ model, where }) {
      let table = storage[model]
      if (!table) return

      let index = table.findIndex((record) => matchesWhere(record, where))
      if (index !== -1) {
        table.splice(index, 1)
      }
    },
  }
}
