export type SessionData = [Record<string, unknown>, Record<string, unknown>]

export class Session {
  /**
   * Create a new cryptographically secure session ID.
   * @returns A new session ID
   */
  static createId(): string {
    return crypto.randomUUID()
  }

  constructor(id = Session.createId(), initialData?: SessionData) {
    this.#id = id
    this.#valueMap = new Map(initialData?.[0] ? Object.entries(initialData[0]) : [])
    this.#flashMap = new Map(initialData?.[1] ? Object.entries(initialData[1]) : [])
    this.#nextMap = new Map()
  }

  #id: string
  readonly #valueMap: Map<string, unknown>
  readonly #flashMap: Map<string, unknown>
  readonly #nextMap: Map<string, unknown>
  #destroyed = false
  #dirty = false

  /**
   * The raw session data in a format suitable for storage.
   * @returns The session data
   */
  get data(): SessionData {
    return this.destroyed
      ? [{}, {}]
      : [Object.fromEntries(this.#valueMap), Object.fromEntries(this.#nextMap)]
  }

  /**
   * Mark this session as destroyed.
   *
   * This prevents all further modifications to the session.
   */
  destroy(): void {
    this.#destroyed = true
  }

  /**
   * Whether this session has been destroyed.
   */
  get destroyed(): boolean {
    return this.#destroyed
  }

  #checkDestroyed(): void {
    if (this.destroyed) {
      throw new Error('Session has been destroyed')
    }
  }

  /**
   * Whether this session has been modified since it was last saved.
   */
  get dirty(): boolean {
    return this.#dirty
  }

  /**
   * Set a value in the session that will be available only for the next request.
   * @param key The key of the value to flash
   * @param value The value to flash
   */
  flash(key: string, value: unknown): void {
    this.#checkDestroyed()
    this.#nextMap.set(key, value)
    this.#dirty = true
  }

  /**
   * Get a value from the session.
   * @param key The key of the value to get
   * @returns The value for the given key
   */
  get(key: string): unknown {
    if (this.destroyed) return undefined
    return this.#valueMap.get(key) ?? this.#flashMap.get(key)
  }

  /**
   * Check if a value is stored for the given key.
   * @param key The key to check
   * @returns `true` if a value is stored for the given key, `false` otherwise
   */
  has(key: string): boolean {
    if (this.destroyed) return false
    return this.#valueMap.has(key) || this.#flashMap.has(key)
  }

  /**
   * The unique identifier for this session.
   */
  get id(): string {
    return this.#id
  }

  /**
   * Regenerate the session ID while preserving the session data.
   * This should be called after login or other privilege changes.
   */
  regenerateId(): void {
    this.#checkDestroyed()
    this.#id = Session.createId()
    this.#dirty = true
  }

  /**
   * The number of key/value pairs in the session.
   */
  get size(): number {
    return this.#valueMap.size + this.#flashMap.size
  }

  /**
   * Set a value in the session.
   * @param key The key of the value to set
   * @param value The value to set
   */
  set(key: string, value: unknown): void {
    if (value == null) {
      this.unset(key)
    } else {
      this.#checkDestroyed()
      this.#valueMap.set(key, value)
      this.#dirty = true
    }
  }

  /**
   * Remove a value from the session.
   * @param key The key of the value to remove
   */
  unset(key: string): void {
    this.#checkDestroyed()
    this.#valueMap.delete(key)
    this.#dirty = true
  }
}

export interface SessionStorage {
  /**
   * Retrieve a new session from storage.
   * @param cookieValue The value of the session cookie
   * @returns The session
   */
  read(cookieValue: string | null): Promise<Session>
  /**
   * Update a session in storage.
   * @param id The ID of the session to save
   * @param data The data to save for the session
   * @returns The value to put in the session cookie
   */
  update(id: string, data: SessionData): Promise<string>
  /**
   * Delete a session from storage.
   * @param id The ID of the session to delete
   * @returns The value to put in the session cookie
   */
  delete(id: string): Promise<string>
}

export interface SessionStorageOptions {
  /**
   * Set `true` to accept and use unknown session IDs from the client. By default, unknown
   * session IDs are rejected and a new session is created instead, which helps prevent session
   * fixation attacks.
   */
  useUnknownIds?: boolean
}
