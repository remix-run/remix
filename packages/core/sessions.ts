/**
 * An object for storing stateful data that persists across requests, commonly
 * known as a "session".
 */
export interface Session {
  /**
   * Sets a value in the session for the given `name`.
   */
  set(name: string, value: string): void;

  /**
   * Sets a temporary value in the session for the given `name` that is only
   * valid until the next `get()`.
   */
  flash(name: string, value: string): void;

  /**
   * Removes a value from the session.
   */
  unset(name: string): void;

  /**
   * Returns the value for the given `name` in this session.
   */
  get(name: string): string | undefined;

  /**
   * Destroys this session.
   */
  destroy(): Promise<void>;

  mutableData: SessionMutableData;
}

/**
 * An object of key/value pairs of data to be used in the session. This object
 * is mutated directly in `set`, `flash`, and `unset` operations.
 */
export interface SessionMutableData {
  [name: string]: string;
}

/**
 * A function that is used to destroy a session.
 */
export interface SessionOnDestroy {
  (): void | Promise<void>;
}

/**
 * Creates a session.
 *
 * Note: This function should not be used directly in application code. Instead,
 * it's used in packages that need to create sessions, like `remix-run/express`.
 */
export function createSession(
  data: SessionMutableData,
  onDestroy?: SessionOnDestroy
): Session {
  let flashPrefix = "__flash__:";

  return {
    mutableData: data,
    set(name, value) {
      data[name] = value;
    },
    flash(name, value) {
      data[flashPrefix + name] = value;
    },
    unset(name) {
      delete data[name];
    },
    get(name) {
      if (name in data) {
        return data[name];
      }

      let flashName = flashPrefix + name;
      if (flashName in data) {
        let value = data[flashName];
        delete data[flashName];
        return value;
      }

      return undefined;
    },
    async destroy() {
      return onDestroy ? await onDestroy() : Promise.resolve();
    }
  };
}

/**
 * Creates a non-functional session facade. This is useful when the underlying
 * framework doesn't support sessions for some reason, for example when
 * `remix-run/express` is used w/out a session middleware.
 *
 * Note: This function should not be used directly in application code. Instead,
 * it's used in packages that need to create sessions, like `remix-run/express`.
 */
export function createSessionFacade(errorMessage: string): Session {
  return {
    set() {
      throw new Error(errorMessage);
    },
    flash() {
      throw new Error(errorMessage);
    },
    unset() {
      throw new Error(errorMessage);
    },
    get() {
      throw new Error(errorMessage);
    },
    destroy() {
      throw new Error(errorMessage);
    },
    mutableData: {}
  };
}
