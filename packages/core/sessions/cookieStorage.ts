import type { Cookie, CookieOptions } from "../cookies";
import { createCookie, isCookie } from "../cookies";
import type { SessionStorage } from "../sessions";
import { createSession } from "../sessions";

interface CookieSessionStorageOptions {
  /**
   * The Cookie used to store the session data on the client, or options used
   * to automatically create one.
   */
  cookie?: Cookie | (CookieOptions & { name?: string });
}

/**
 * Creates and returns a SessionStorage object that stores all session data
 * directly in the session cookie itself.
 *
 * This has the advantage that no database or other backend services are
 * needed, and can help to simplify some load-balanced scenarios. However, it
 * also has the limitation that serialized session data may not exceed the
 * browser's maximum cookie size. Trade-offs! :D
 *
 * This storage supports signing session cookies using one or more `secrets`,
 * which may be rotated periodically. Incoming request cookies may be decoded
 * using any of the given secrets, but outgoing cookies (response `Set-Cookie`)
 * will always be encoded using the first secret, so new secrets should always
 * be added at the beginning of the `secrets` array.
 */
export function createCookieSessionStorage({
  cookie: cookieArg
}: CookieSessionStorageOptions = {}): SessionStorage {
  let cookie = isCookie(cookieArg)
    ? cookieArg
    : createCookie((cookieArg && cookieArg.name) || "remix:session", cookieArg);

  if (!cookie.isSigned) {
    // TODO: Link to doc about how to sign cookies...
    console.warn(
      `Session cookies should be signed to prevent tampering on the client ` +
        `before they are sent back to the server.`
    );
  }

  return {
    async getSession(cookieHeader, options) {
      let data = cookie.parse(cookieHeader, options);
      return createSession(data || {});
    },
    async commitSession(session, options) {
      return cookie.serialize(session.data, options);
    },
    async destroySession(_session, options) {
      return cookie.serialize("", {
        ...options,
        expires: new Date(0)
      });
    }
  };
}
