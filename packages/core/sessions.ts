/**
 * An object for storing stateful data that persists across requests, commonly
 * known as a "session".
 */
export interface Session {
  /**
   * Sets a value in the session.
   */
  set(name: string, value: string): void;

  /**
   * Sets a temporary value in the session, only valid on the next request.
   */
  flash(name: string, value: string): void;

  /**
   * Removes a value from the session.
   */
  unset(name: string): void;

  /**
   * Returns the value for the given `name` in this session.
   */
  get(name: string): string;

  /**
   * Destroys this session.
   */
  destroy(): Promise<void>;
}

/**
 * Creates a non-functional session stub. Useful in packages that need
 * to create sessions, like `remix-run/express`.
 */
export function createSessionStub(errorMessage: string): Session {
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
    }
  };
}
