import type { ParseOptions, SerializeOptions } from 'cookie'
import type { Cookie, CookieOptions } from '@remix-run/cookie'
import { createCookie, isCookie } from '@remix-run/cookie'

import { warnOnce } from './warnings.ts'

/**
 * An object of name/value pairs to be used in the session.
 */
export interface SessionData {
  [name: string]: unknown
}

/**
 * Session persists data across HTTP requests.
 */
export interface Session<Data = SessionData, FlashData = Data> {
  /**
   * A unique identifier for this session.
   *
   * Note: This will be the empty string for newly created sessions and
   * sessions that are not backed by a database (i.e. cookie-based sessions).
   */
  readonly id: string

  /**
   * The raw data contained in this session.
   *
   * This is useful mostly for SessionStorage internally to access the raw
   * session data to persist.
   */
  readonly data: FlashSessionData<Data, FlashData>

  /**
   * A value indicating the status of the session.
   *
   * This is useful for middlewares to know if they need to commit the session.
   */
  readonly status: 'new' | 'clean' | 'dirty' | 'destroyed'

  /**
   * Returns `true` if the session has a value for the given `name`, `false`
   * otherwise.
   */
  has(name: (keyof Data | keyof FlashData) & string): boolean

  /**
   * Returns the value for the given `name` in this session.
   */
  get<Key extends (keyof Data | keyof FlashData) & string>(
    name: Key,
  ):
    | (Key extends keyof Data ? Data[Key] : undefined)
    | (Key extends keyof FlashData ? FlashData[Key] : undefined)
    | undefined

  /**
   * Sets a value in the session for the given `name`.
   */
  set<Key extends keyof Data & string>(name: Key, value: Data[Key]): void

  /**
   * Sets a value in the session that is only valid until the next `get()`.
   * This can be useful for temporary values, like error messages.
   */
  flash<Key extends keyof FlashData & string>(name: Key, value: FlashData[Key]): void

  /**
   * Removes a value from the session.
   */
  unset(name: keyof Data & string): void

  /**
   * Clears a session for destruction
   **/
  destroy(): void
}

export type FlashSessionData<Data, FlashData> = Partial<
  Data & {
    [Key in keyof FlashData as FlashDataKey<Key & string>]: FlashData[Key]
  }
>
type FlashDataKey<Key extends string> = `__flash_${Key}__`
function flash<Key extends string>(name: Key): FlashDataKey<Key> {
  return `__flash_${name}__`
}

/**
 * Creates a new Session object.
 *
 * Note: This function is typically not invoked directly by application code.
 * Instead, use a `SessionStorage` object's `getSession` method.
 */
export function createSession<Data = SessionData, FlashData = Data>(
  initialData?: Partial<Data>,
  id?: string,
): Session<Data, FlashData> {
  // Brand new sessions start in a dirty state to force an initial commit
  let status: 'new' | 'clean' | 'dirty' | 'destroyed' =
    initialData == null && id == null ? 'new' : 'clean'

  initialData ||= {}
  id ??= ''

  let map = new Map(Object.entries(initialData)) as Map<
    keyof Data | FlashDataKey<keyof FlashData & string>,
    any
  >

  let throwIfDestroyed = () => {
    if (status === 'destroyed') {
      throw new Error('Cannot operate on a destroyed session')
    }
  }

  return {
    get id() {
      return id
    },
    get data() {
      return Object.fromEntries(map) as FlashSessionData<Data, FlashData>
    },
    get status() {
      return status
    },
    has(name) {
      return map.has(name as keyof Data) || map.has(flash(name as keyof FlashData & string))
    },
    get(name) {
      if (map.has(name as keyof Data)) return map.get(name as keyof Data)

      let flashName = flash(name as keyof FlashData & string)
      if (map.has(flashName)) {
        let value = map.get(flashName)
        map.delete(flashName)
        status = 'dirty'
        return value
      }

      return undefined
    },
    set(name, value) {
      throwIfDestroyed()
      map.set(name, value)
      status = 'dirty'
    },
    flash(name, value) {
      throwIfDestroyed()
      map.set(flash(name), value)
      status = 'dirty'
    },
    unset(name) {
      throwIfDestroyed()
      map.delete(name)
      status = 'dirty'
    },
    destroy() {
      map.clear()
      status = 'destroyed'
    },
  }
}

/**
 * Returns true if an object is a Remix session.
 */
export function isSession(object: unknown): object is Session {
  return (
    typeof object === 'object' &&
    object != null &&
    'id' in object &&
    typeof object.id === 'string' &&
    'data' in object &&
    typeof object.data !== 'undefined' &&
    'has' in object &&
    typeof object.has === 'function' &&
    'get' in object &&
    typeof object.get === 'function' &&
    'set' in object &&
    typeof object.set === 'function' &&
    'flash' in object &&
    typeof object.flash === 'function' &&
    'unset' in object &&
    typeof object.unset === 'function'
  )
}

/**
 * SessionStorage stores session data between HTTP requests and knows how to
 * parse and create cookies.
 *
 * A SessionStorage creates Session objects using a `Cookie` header as input.
 * Then, later it generates the `Set-Cookie` header to be used in the response.
 */
export interface SessionStorage<Data = SessionData, FlashData = Data> {
  /**
   * Parses a Cookie header from a HTTP request and returns the associated
   * Session. If there is no session associated with the cookie, this will
   * return a new Session with no data.
   */
  getSession: (
    cookieHeader?: string | null,
    options?: ParseOptions,
  ) => Promise<Session<Data, FlashData>>

  /**
   * Stores all data in the Session and returns the Set-Cookie header to be
   * used in the HTTP response.
   */
  commitSession: (session: Session<Data, FlashData>, options?: SerializeOptions) => Promise<string>

  /**
   * Deletes all data associated with the Session and returns the Set-Cookie
   * header to be used in the HTTP response.
   */
  destroySession: (session: Session<Data, FlashData>, options?: SerializeOptions) => Promise<string>
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
export interface SessionIdStorageStrategy<Data = SessionData, FlashData = Data> {
  /**
   * The Cookie used to store the session id, or options used to automatically
   * create one.
   */
  cookie?: Cookie | (CookieOptions & { name?: string })

  /**
   * Creates a new record with the given data and returns the session id.
   */
  createData: (data: FlashSessionData<Data, FlashData>, expires?: Date) => Promise<string>

  /**
   * Returns data for a given session id, or `null` if there isn't any.
   */
  readData: (id: string) => Promise<FlashSessionData<Data, FlashData> | null>

  /**
   * Updates data for the given session id.
   */
  updateData: (id: string, data: FlashSessionData<Data, FlashData>, expires?: Date) => Promise<void>

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
export function createSessionStorage<Data = SessionData, FlashData = Data>({
  cookie: cookieArg,
  createData,
  readData,
  updateData,
  deleteData,
}: SessionIdStorageStrategy<Data, FlashData>): SessionStorage<Data, FlashData> {
  let cookie = isCookie(cookieArg)
    ? cookieArg
    : createCookie(cookieArg?.name || '__session', cookieArg)

  warnOnceAboutSigningSessionCookie(cookie)

  return {
    async getSession(cookieHeader, options) {
      let id = cookieHeader && (await cookie.parse(cookieHeader, options))
      let data = id && (await readData(id))
      return createSession(data, id)
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
