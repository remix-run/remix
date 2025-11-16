import type { Session } from './session.ts'

export interface SessionStorage {
  /**
   * Retrieve a new session from storage based on the session cookie in the request.
   * @param request The request that contains the session cookie
   */
  read(request: Request): Promise<Session>
  /**
   * Save session data in storage and write the session cookie to the response.
   * @param session The session to save
   * @param response The response to write the session cookie to
   */
  save(session: Session, response: Response): Promise<void>
}
