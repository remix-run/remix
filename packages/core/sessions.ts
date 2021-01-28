import type { CookieParseOptions, CookieSerializeOptions } from "cookie";

import type { Cookie, CookieOptions } from "./cookies";
import { createCookie, isCookie } from "./cookies";

/**
 * An object of name/value pairs to be used in the session.
 */
export interface SessionData {
  [name: string]: any;
}

/**
 * Session persists data across HTTP requests.
 */
export interface Session {
  /**
   * A unique identifier for this session.
   *
   * Note: This will be the empty string for newly created sessions and
   * sessions that are not backed by a database (i.e. cookie-based sessions).
   */
  readonly id: string;

  /**
   * The raw data contained in this session.
   *
   * This is useful mostly for SessionStorage internally to access the raw
   * session data to persist.
   */
  readonly data: SessionData;

  /**
   * Returns the value for the given `name` in this session.
   */
  get(name: string): any;

  /**
   * Sets a value in the session for the given `name`.
   */
  set(name: string, value: any): void;

  /**
   * Sets a value in the session that is only valid until the next `get()`.
   * This can be useful for temporary values, like error messages.
   */
  flash(name: string, value: any): void;

  /**
   * Removes a value from the session.
   */
  unset(name: string): void;
}

function flash(name: string): string {
  return `__flash_${name}__`;
}

/**
 * Creates a new Session object.
 *
 * Note: This function is usually not invoked directly by application code.
 * Instead, use a SessionStorage object's `createSession` method.
 */
export function createSession(initialData: SessionData = {}, id = ""): Session {
  let map = new Map<string, any>(Object.entries(initialData));

  return {
    get id() {
      return id;
    },
    get data() {
      return Object.fromEntries(map);
    },
    get(name) {
      if (map.has(name)) return map.get(name);

      let flashName = flash(name);
      if (map.has(flashName)) {
        let value = map.get(flashName);
        map.delete(flashName);
        return value;
      }

      return undefined;
    },
    set(name, value) {
      map.set(name, value);
    },
    flash(name, value) {
      map.set(flash(name), value);
    },
    unset(name) {
      map.delete(name);
    }
  };
}

export function isSession(object: any): object is Session {
  return (
    object &&
    typeof object.id === "string" &&
    typeof object.data !== "undefined" &&
    typeof object.get === "function" &&
    typeof object.set === "function" &&
    typeof object.consume === "function" &&
    typeof object.delete === "function"
  );
}

/**
 * SessionStorage stores session data between HTTP requests and knows how to
 * parse and create cookies.
 *
 * A SessionStorage creates Session objects using a Cookie header as input.
 * Then, later it generates the Set-Cookie header to be used in the response.
 *
 * An example of usage on a protected route:
 *
 *   let cookie = request.headers.get('Cookie');
 *   let session = await storage.getSession(cookie);
 *
 *   if (!session.get('user')) {
 *     return redirect('/login', {
 *       headers: {
 *         'Set-Cookie': await storage.commitSession(session)
 *       }
 *     });
 *   }
 *
 *   // do stuff with the session...
 *
 *   return new Response(..., {
 *     headers: {
 *       'Set-Cookie': await storage.commitSession(session)
 *     }
 *   });
 */
export interface SessionStorage {
  /**
   * Parses a Cookie header from a HTTP request and returns the associated
   * Session. If there is no session associated with the cookie, this will
   * return a new Session with no data.
   */
  getSession(
    cookieHeader?: string,
    options?: CookieParseOptions
  ): Promise<Session>;

  /**
   * Stores all data in the Session and returns the Set-Cookie header to be
   * used in the HTTP response.
   */
  commitSession(
    session: Session,
    options?: CookieSerializeOptions
  ): Promise<string>;

  /**
   * Deletes all data associated with the Session and returns the Set-Cookie
   * header to be used in the HTTP response.
   */
  destroySession(
    session: Session,
    options?: CookieSerializeOptions
  ): Promise<string>;
}

/**
 * CookieIdSessionStorageStrategy is designed to allow anyone to easily build
 * their own SessionStorage using `createSessionStorage(strategy)`.
 *
 * This strategy describes a common scenario where the session id is stored in a
 * HTTP cookie but the actual session data is stored elsewhere, probably in a
 * database or on disk.
 */
export interface CookieIdSessionStorageStrategy {
  /**
   * The Cookie used to store the session id, or options used to automatically
   * create one.
   */
  cookie?: Cookie | (CookieOptions & { name?: string });

  /**
   * Creates a new record with the given data and returns the session id.
   */
  createData: (data: SessionData) => Promise<string>;

  /**
   * Returns data for a given session id, or `null` if there isn't any.
   */
  readData: (id: string) => Promise<SessionData | null>;

  /**
   * Updates data for the given session id.
   */
  updateData: (id: string, data: SessionData) => Promise<void>;

  /**
   * Deletes data for a given session id from the data store.
   */
  deleteData: (id: string) => Promise<void>;
}

/**
 * Creates a SessionStorage object using a CookieIdSessionStorageStrategy.
 *
 * Note: This is a low-level API that should only be used if none of the
 * existing session storage options meet your requirements.
 */
export function createSessionStorage({
  cookie: cookieArg,
  createData,
  readData,
  updateData,
  deleteData
}: CookieIdSessionStorageStrategy): SessionStorage {
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
      let id = cookie.parse(cookieHeader, options);
      let data = id && (await readData(id));
      return createSession(data || {}, id || "");
    },
    async commitSession(session, options) {
      let { id, data } = session;

      if (id) {
        await updateData(id, data);
      } else {
        id = await createData(data);
      }

      return cookie.serialize(id, options);
    },
    async destroySession(session, options) {
      await deleteData(session.id);
      return cookie.serialize("", {
        ...options,
        expires: new Date(0)
      });
    }
  };
}
