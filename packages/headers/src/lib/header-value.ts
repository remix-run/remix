/**
 * Anything that can be used to initialize a header value.
 * Just needs to be convertible to a string.
 */
export interface HeaderValueInit {
  toString(): string
}

/**
 * Abstract base class for header values.
 * Enforces that reset() accepts the same types as the constructor via the super(init) call.
 *
 * Derived classes must call `super(init)` then `this.reset(init)` in their constructor,
 * since class field initializers run after super() completes.
 */
export abstract class HeaderValue<Init = unknown> implements HeaderValueInit {
  constructor(init?: Init) {}

  /**
   * Resets the header to the given value, or clears it if no value is provided.
   * This mirrors the constructor behavior but on an existing instance.
   */
  abstract reset(init?: Init): void

  abstract toString(): string
}
