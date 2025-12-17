import type { Session } from './session.ts'

/**
 * An interface for storing and retrieving session data.
 */
export interface SessionStorage {
  /**
   * Retrieve a new session from storage based on the session cookie.
   *
   * @param cookie The session cookie value, or `null` if no session cookie is available
   * @returns The session
   */
  read(cookie: string | null): Promise<Session>
  /**
   * Save session data in storage and return the session cookie.
   *
   * Note: If no session cookie should be set, this method returns `null`.
   *
   * @param session The session to save
   * @returns The session cookie value, or `null` if no session cookie should be set
   */
  save(session: Session): Promise<string | null>
}
