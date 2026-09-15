import type { Session } from './session.ts';
/**
 * Stores and retrieves session data using values read from a session cookie.
 *
 * Session storage implementations operate on cookie values. Use `remix/cookie` or
 * `remix/middleware/session` to parse incoming `Cookie` headers and serialize outgoing
 * `Set-Cookie` headers.
 */
export interface SessionStorage {
    /**
     * Retrieve a session from storage using a value read from the session cookie.
     *
     * @param cookie The stored session cookie value, or `null` if no session cookie is available
     * @returns The session
     */
    read(cookie: string | null): Promise<Session>;
    /**
     * Save session data in storage and return the value to write to the session cookie.
     *
     * Note: If no session cookie should be set, this method returns `null`. If the session
     * should be destroyed, this method returns an empty string.
     *
     * @param session The session to save
     * @returns The stored session cookie value, or `null` if no session cookie should be set
     */
    save(session: Session): Promise<string | null>;
}
//# sourceMappingURL=session-storage.d.ts.map