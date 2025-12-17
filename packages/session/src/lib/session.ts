type Data = Record<string, unknown>

export type SessionData<valueData extends Data = Data, flashData extends Data = Data> = [
  valueData,
  flashData,
]

/**
 * A session persists data for a specific user across multiple requests to a server.
 */
export class Session<valueData extends Data = Data, flashData extends Data = Data> {
  #originalId: string
  #currentId: string
  #deleteId: string | undefined = undefined
  #valueMap: Map<keyof valueData, valueData[keyof valueData]>
  #flashMap: Map<keyof flashData, flashData[keyof flashData]>
  #nextMap: Map<keyof flashData, flashData[keyof flashData]>
  #destroyed = false
  #dirty: boolean

  /**
   * @param id The session ID
   * @param initialData The initial session data
   */
  constructor(id = createSessionId(), initialData?: SessionData<valueData, flashData>) {
    this.#originalId = id
    this.#currentId = id
    this.#valueMap = toMap(initialData?.[0])
    this.#flashMap = toMap(initialData?.[1])
    this.#nextMap = new Map<keyof flashData, flashData[keyof flashData]>()
    // Mark as dirty if flash data exists so it gets cleared on save
    this.#dirty = this.#flashMap.size > 0
  }

  #checkDestroyed() {
    if (this.#destroyed) throw new Error('Session has been destroyed')
  }

  /**
   * The raw session data in a format suitable for storage.
   *
   * Note: Do not use this for normal reading of session data. Use the `get` method instead.
   */
  get data(): SessionData<valueData, flashData> {
    return (
      this.#destroyed
        ? [{}, {}]
        : [Object.fromEntries(this.#valueMap), Object.fromEntries(this.#nextMap)]
    ) as SessionData<valueData, flashData>
  }

  /**
   * The session ID that will be deleted when the session is saved. This is set to the original
   * session ID when the session ID is regenerated with the `deleteOldSession` option.
   */
  get deleteId(): string | undefined {
    return this.#deleteId
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

  /**
   * Whether this session has been modified since it was created.
   */
  get dirty(): boolean {
    return this.#dirty
  }

  /**
   * Set a value in the session that will be available only during the next request.
   * @param key The key of the value to flash
   * @param value The value to flash
   */
  flash<key extends keyof flashData>(key: key, value: flashData[key]): void {
    this.#checkDestroyed()
    this.#nextMap.set(key, value)
    this.#dirty = true
  }

  /**
   * Get a value from the session.
   *
   * @param key The key of the value to get
   * @returns The value for the given key
   */
  get<key extends keyof valueData>(key: key): valueData[key] | undefined
  get<key extends keyof flashData>(key: key): flashData[key] | undefined
  get(key: string): undefined
  get(key: string) {
    if (this.#destroyed) return undefined as any
    return this.#valueMap.get(key as any) ?? this.#flashMap.get(key as any)
  }

  /**
   * Check if a value is stored for the given key.
   *
   * @param key The key to check
   * @returns `true` if a value is stored for the given key, `false` otherwise
   */
  has(key: keyof valueData | keyof flashData): boolean {
    if (this.#destroyed) return false
    return this.#valueMap.has(key as any) || this.#flashMap.has(key as any)
  }

  /**
   * The unique identifier for this session.
   */
  get id(): string {
    return this.#currentId
  }

  /**
   * Regenerate the session ID while preserving the session data. This should be called after login
   * or other privilege changes.
   *
   * @param deleteOldSession Whether to delete the old session data when the session is saved (default: `false`)
   */
  regenerateId(deleteOldSession = false): void {
    this.#checkDestroyed()
    if (deleteOldSession) this.#deleteId = this.#originalId
    this.#currentId = createSessionId()
    this.#dirty = true
  }

  /**
   * Set a value in the session.
   * @param key The key of the value to set
   * @param value The value to set
   */
  set<key extends keyof valueData>(key: key, value: valueData[key]): void {
    this.#checkDestroyed()
    if (value == null) {
      this.#valueMap.delete(key as any)
    } else {
      this.#valueMap.set(key as any, value)
    }
    this.#dirty = true
  }

  /**
   * The number of key/value pairs in the session.
   */
  get size(): number {
    if (this.#destroyed) return 0
    return this.#valueMap.size + this.#flashMap.size
  }

  /**
   * Remove a value from the session.
   * @param key The key of the value to remove
   */
  unset(key: keyof valueData): void {
    this.#checkDestroyed()
    this.#valueMap.delete(key as any)
    this.#dirty = true
  }
}

function toMap<data extends Data>(data?: data): Map<keyof data, data[keyof data]> {
  if (!data) return new Map()
  return new Map(Object.entries(data) as [keyof data, data[keyof data]][])
}

/**
 * Create a new session.
 *
 * @param id The ID of the session
 * @param initialData The initial data for the session
 * @returns The new session
 */
export function createSession<valueData extends Data = Data, flashData extends Data = Data>(
  id = createSessionId(),
  initialData?: SessionData<valueData, flashData>,
): Session<valueData, flashData> {
  return new Session(id, initialData)
}

/**
 * Create a new cryptographically secure session ID.
 *
 * @returns A new session ID
 */
export function createSessionId(): string {
  return crypto.randomUUID()
}
