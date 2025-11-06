import {
  type SessionStorage,
  type SessionStorageOptions,
  type SessionData,
  Session,
} from './session.ts'

/**
 * Stores all session data in memory.
 *
 * Note: This is useful for testing and development. All session data is lost when the
 * server restarts.
 */
export class MemorySessionStorage implements SessionStorage {
  constructor(options?: SessionStorageOptions) {
    this.#useUnknownIds = options?.useUnknownIds ?? false
  }

  #useUnknownIds: boolean
  #map = new Map<string, SessionData>()

  async read(cookieValue: string | null): Promise<Session> {
    let id = cookieValue

    if (id != null && this.#map.has(id)) {
      return new Session(id, this.#map.get(id)!)
    }

    let session = new Session(id != null && this.#useUnknownIds ? id : undefined)
    this.#map.set(session.id, session.data)

    return session
  }

  async update(id: string, data: SessionData): Promise<string> {
    this.#map.set(id, data)
    return id
  }

  async delete(id: string): Promise<string> {
    this.#map.delete(id)
    return ''
  }
}
