import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Storage, Where } from '../storage.ts'

/**
 * File-based storage structure
 * Each model is stored as an array of records
 */
interface FsDB {
  [model: string]: any[]
}

/**
 * Create a file-based storage adapter for local development
 *
 * This adapter stores all data in a single JSON file, making it easy to
 * inspect and debug during development. Data persists across server restarts.
 *
 * The file is read from disk on every operation (no caching), so you can
 * manually edit the JSON file and see changes immediately without restarting.
 *
 * ⚠️ This adapter is intended for local development only. It is not suitable
 * for production use.
 *
 * @example
 * ```ts
 * import { createFsStorageAdapter } from '@remix-run/auth/storage-adapters/fs'
 *
 * let authClient = createAuthClient({
 *   storage: createFsStorageAdapter('./tmp/db/db.json'),
 * })
 * ```
 *
 * @param filePath - Path to the JSON file (directory will be created if needed)
 */
export function createFsStorageAdapter(filePath: string): Storage {
  function loadFromDisk(): FsDB {
    // Create directory if it doesn't exist
    let dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // Load existing data or start fresh
    if (existsSync(filePath)) {
      let content = readFileSync(filePath, 'utf-8')
      return JSON.parse(content) as FsDB
    } else {
      return {}
    }
  }

  function persist(data: FsDB): void {
    // Atomic write: write to temp file, then rename
    let tmpPath = `${filePath}.tmp`
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    renameSync(tmpPath, filePath)
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
      let storage = loadFromDisk()
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
      let storage = loadFromDisk()
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
      let storage = loadFromDisk()
      let table = storage[model]
      if (!table) {
        table = []
        storage[model] = table
      }

      // Generate ID if not provided
      if (!data.id) {
        data.id = crypto.randomUUID()
      }

      table.push(data)
      persist(storage)
      return data as T
    },

    async update({ model, where, data }) {
      let storage = loadFromDisk()
      let table = storage[model]
      if (!table) throw new Error(`Model ${model} not found`)

      for (let i = 0; i < table.length; i++) {
        if (matchesWhere(table[i], where)) {
          let updated = { ...table[i], ...data }
          table[i] = updated
          persist(storage)
          return updated
        }
      }

      throw new Error('Record not found for update')
    },

    async delete({ model, where }) {
      let storage = loadFromDisk()
      let table = storage[model]
      if (!table) return

      let index = table.findIndex((record) => matchesWhere(record, where))
      if (index !== -1) {
        table.splice(index, 1)
        persist(storage)
      }
    },
  }
}
