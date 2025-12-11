import type { SecondaryStorage } from './types.ts'

interface MemoryEntry {
  value: string
  expiresAt?: number
}

/**
 * In-memory secondary storage adapter
 *
 * Good for:
 * - Development
 * - Single-instance production deployments
 *
 * Note: Data is lost on server restart
 */
export function createMemorySecondaryStorage(): SecondaryStorage {
  let store = new Map<string, MemoryEntry>()

  return {
    async get(key) {
      let entry = store.get(key)
      if (!entry) return null

      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key)
        return null
      }

      return entry.value
    },

    async set(key, value, ttl) {
      store.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
      })
    },

    async delete(key) {
      store.delete(key)
    },
  }
}
