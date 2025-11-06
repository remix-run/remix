import { type SessionStorage, type SessionData, Session } from './session.ts'

/**
 * Stores session data in the session cookie itself.
 *
 * This is suitable for use in production. However, the total size of the session cookie is limited
 * to the browser's maximum cookie size, typically 4096 bytes.
 */
export class CookieSessionStorage implements SessionStorage {
  async read(cookieValue: string | null): Promise<Session> {
    if (cookieValue == null) return new Session()

    try {
      let value = JSON.parse(cookieValue) as { i: string; d: SessionData }
      return new Session(value.i, value.d)
    } catch {
      return new Session()
    }
  }

  async update(id: string, data: SessionData): Promise<string> {
    return JSON.stringify({ i: id, d: data })
  }

  async delete(_: string): Promise<string> {
    return ''
  }
}
