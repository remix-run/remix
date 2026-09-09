import type { SessionStorage } from '../session-storage.ts';
/**
 * Creates a session storage that stores all session data in the session cookie itself.
 *
 * Note: This is suitable for use in production. However, the total size of the session cookie is limited
 * to the browser's maximum cookie size, typically 4096 bytes.
 *
 * @returns The session storage
 */
export declare function createCookieSessionStorage(): SessionStorage;
//# sourceMappingURL=cookie.d.ts.map