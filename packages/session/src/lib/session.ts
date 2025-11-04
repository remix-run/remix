import type { CookieOptions, CookieParseOptions, CookieSerializeOptions } from '@remix-run/cookie'
import { Cookie } from '@remix-run/cookie'

import { warnOnce } from './warnings.ts'

export type SessionData = Record<string, unknown>

/**
 * Session persists data across HTTP requests.
 *
 * Note: This class is typically not invoked directly by application code.
 * Instead, use a `SessionStorage` object's `getSession` method.
 */
export class Session {
  #id: string
  #map: Map<keyof SessionData, SessionData[keyof SessionData]>
  #status: 'clean' | 'dirty' | 'destroyed'

  constructor(initialData?: SessionData | null, id?: string) {
    this.#status = 'clean'
    this.#id = id ?? ''
    this.#map = new Map(initialData ? Object.entries(initialData) : undefined)
  }

  /**
   * A unique identifier for this session.
   *
   * Note: This will be the empty string for newly created sessions and
   * sessions that are not backed by a database (i.e. cookie-based sessions).
   */
  get id() {
    return this.#id
  }

  /**
   * A value indicating the status of the session.
   *
   * This is useful for middlewares to know if they need to commit the session.
   */
  get status() {
    return this.#status
  }

  /**
   * The raw data contained in this session.
   *
   * This is useful mostly for SessionStorage internally to access the raw
   * session data to persist.
   */
  get data() {
    return Object.fromEntries(this.#map)
  }

  /**
   * Returns `true` if the session has a value for the given `name`, `false`
   * otherwise.
   */
  has(name: string) {
    return this.#map.has(name) || this.#map.has(flash(name))
  }

  /**
   * Returns the value for the given `name` in this session.
   */
  get(name: string) {
    if (this.#map.has(name)) {
      return this.#map.get(name)
    }

    let flashName = flash(name)
    if (this.#map.has(flashName)) {
      let value = this.#map.get(flashName)
      this.#map.delete(flashName)
      this.#status = 'dirty'
      return value
    }

    return undefined
  }

  /**
   * Sets a value in the session for the given `name`.
   */
  set(name: string, value: unknown) {
    this.#throwIfDestroyed()
    this.#map.set(name, value)
    this.#status = 'dirty'
  }

  /**
   * Sets a value in the session that is only valid until the next `get()`.
   * This can be useful for temporary values, like error messages.
   */
  flash(name: string, value: unknown) {
    this.#throwIfDestroyed()
    this.#map.set(flash(name), value)
    this.#status = 'dirty'
  }

  /**
   * Removes a value from the session.
   */
  unset(name: string) {
    this.#throwIfDestroyed()
    this.#map.delete(name)
    this.#status = 'dirty'
  }

  /**
   * Clears a session for destruction
   **/
  destroy() {
    this.#map.clear()
    this.#status = 'destroyed'
  }

  #throwIfDestroyed() {
    if (this.#status === 'destroyed') {
      throw new Error('Cannot operate on a destroyed session')
    }
  }
}

function flash(name: string): string {
  return `__flash_${name}__`
}

/**
 * SessionStorage stores session data between HTTP requests and knows how to
 * parse and create cookies.
 *
 * A SessionStorage creates Session objects using a `Cookie` header as input.
 * Then, later it generates the `Set-Cookie` header to be used in the response.
 */
export interface SessionStorage {
  /**
   * Parses a Cookie header from a HTTP request and returns the associated
   * Session. If there is no session associated with the cookie, this will
   * return a new Session with no data.
   */
  getSession: (cookieHeader?: string | null, options?: CookieParseOptions) => Promise<Session>

  /**
   * Stores all data in the Session and returns the Set-Cookie header to be
   * used in the HTTP response.
   */
  commitSession: (session: Session, options?: CookieSerializeOptions) => Promise<string>

  /**
   * Deletes all data associated with the Session and returns the Set-Cookie
   * header to be used in the HTTP response.
   */
  destroySession: (session: Session, options?: CookieSerializeOptions) => Promise<string>
}

/**
 * SessionIdStorageStrategy is designed to allow anyone to easily build their
 * own SessionStorage using `createSessionStorage(strategy)`.
 *
 * This strategy describes a common scenario where the session id is stored in
 * a cookie but the actual session data is stored elsewhere, usually in a
 * database or on disk. A set of create, read, update, and delete operations
 * are provided for managing the session data.
 */
export interface SessionIdStorageStrategy {
  /**
   * The Cookie used to store the session id, or options used to automatically
   * create one.
   */
  cookie?: Cookie | (CookieOptions & { name?: string })

  /**
   * Creates a new record with the given data and returns the session id.
   */
  createData: (data: SessionData, expires?: Date) => Promise<string>

  /**
   * Returns data for a given session id, or `null` if there isn't any.
   */
  readData: (id: string) => Promise<SessionData | null>

  /**
   * Updates data for the given session id.
   */
  updateData: (id: string, data: SessionData, expires?: Date) => Promise<void>

  /**
   * Deletes data for a given session id from the data store.
   */
  deleteData: (id: string) => Promise<void>
}

/**
 * Creates a SessionStorage object using a SessionIdStorageStrategy.
 *
 * Note: This is a low-level API that should only be used if none of the
 * existing session storage options meet your requirements.
 */
export function createSessionStorage({
  cookie: cookieArg,
  createData,
  readData,
  updateData,
  deleteData,
}: SessionIdStorageStrategy): SessionStorage {
  let cookie =
    cookieArg instanceof Cookie ? cookieArg : new Cookie(cookieArg?.name || '__session', cookieArg)

  warnOnceAboutSigningSessionCookie(cookie)

  return {
    async getSession(cookieHeader, options) {
      let id = cookieHeader && (await cookie.parse(cookieHeader, options))
      if (typeof id === 'string' && id !== '') {
        let data = await readData(id)
        return new Session(data, id)
      }
      return new Session()
    },
    async commitSession(session, options) {
      let { id, data } = session
      let expires =
        options?.maxAge != null
          ? new Date(Date.now() + options.maxAge * 1000)
          : options?.expires != null
            ? options.expires
            : cookie.expires

      if (id) {
        await updateData(id, data, expires)
      } else {
        id = await createData(data, expires)
      }

      return cookie.serialize(id, options)
    },
    async destroySession(session, options) {
      await deleteData(session.id)
      return cookie.serialize('', {
        ...options,
        maxAge: undefined,
        expires: new Date(0),
      })
    },
  }
}

export function warnOnceAboutSigningSessionCookie(cookie: Cookie) {
  warnOnce(
    cookie.isSigned,
    `The "${cookie.name}" cookie is not signed, but session cookies should be ` +
      `signed to prevent tampering on the client before they are sent back to the ` +
      `server.`,
  )
}
