import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SecondaryStorage } from './types.ts'

interface FsEntry {
  value: string
  expiresAt?: number
}

type FsData = Record<string, FsEntry>

/**
 * Filesystem-based secondary storage adapter
 *
 * Good for:
 * - Local development (survives restarts, inspectable)
 *
 * Note: Uses synchronous file operations for simplicity.
 * Not recommended for production with high concurrency.
 *
 * @param filePath Full path to the JSON file (e.g., './tmp/kv/kv.json')
 */
export function createFsSecondaryStorage(filePath: string): SecondaryStorage {
  // Ensure directory exists
  let dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  function readData(): FsData {
    if (!fs.existsSync(filePath)) {
      return {}
    }
    let content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  }

  function writeData(data: FsData): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  }

  function cleanExpired(data: FsData): FsData {
    let now = Date.now()
    let cleaned: FsData = {}
    for (let [key, entry] of Object.entries(data)) {
      if (!entry.expiresAt || entry.expiresAt > now) {
        cleaned[key] = entry
      }
    }
    return cleaned
  }

  return {
    async get(key) {
      let data = readData()
      let entry = data[key]
      if (!entry) return null

      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        delete data[key]
        writeData(data)
        return null
      }

      return entry.value
    },

    async set(key, value, ttl) {
      let data = readData()

      // Clean expired entries periodically
      data = cleanExpired(data)

      data[key] = {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
      }

      writeData(data)
    },

    async delete(key) {
      let data = readData()
      delete data[key]
      writeData(data)
    },
  }
}
