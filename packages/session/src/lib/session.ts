type Data<T = unknown> = Record<string, T>

export type SessionData<valueData extends Data = Data, flashData extends Data = Data> = [
  valueData,
  flashData,
]

export class Session<valueData extends Data = Data, flashData extends Data = Data> {
  /**
   * Create a new cryptographically secure session ID.
   * @returns A new session ID
   */
  static createId(): string {
    return crypto.randomUUID()
  }

  constructor(id = Session.createId(), initialData?: SessionData<valueData, flashData>) {
    this.#id = id
    this.#valueMap = toMap(initialData?.[0])
    this.#flashMap = toMap(initialData?.[1])
    this.#nextMap = new Map()
  }

  #id: string
  readonly #valueMap: Map<keyof valueData, valueData[keyof valueData]>
  readonly #flashMap: Map<keyof flashData, flashData[keyof flashData]>
  readonly #nextMap: Map<keyof flashData, flashData[keyof flashData]>
  #destroyed = false
  #dirty = false

  /**
   * The raw session data in a format suitable for storage.
   * @returns The session data
   */
  get data(): SessionData<valueData, flashData> {
    if (this.destroyed) return [{} as valueData, {} as flashData]
    return [
      Object.fromEntries(this.#valueMap) as valueData,
      Object.fromEntries(this.#nextMap) as flashData,
    ]
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
  flash<key extends keyof flashData>(key: key, value: flashData[key]): void {
    this.#checkDestroyed()
    this.#nextMap.set(key, value)
    this.#dirty = true
  }

  /**
   * Get a value from the session.
   * @param key The key of the value to get
   * @returns The value for the given key
   */
  get<key extends keyof valueData | keyof flashData>(
    key: key,
  ): key extends keyof valueData
    ? valueData[key]
    : key extends keyof flashData
      ? flashData[key]
      : never {
    if (this.destroyed) return undefined as any
    return (this.#valueMap.get(key as any) ?? this.#flashMap.get(key as any)) as any
  }

  /**
   * Check if a value is stored for the given key.
   * @param key The key to check
   * @returns `true` if a value is stored for the given key, `false` otherwise
   */
  has(key: keyof valueData | keyof flashData): boolean {
    if (this.destroyed) return false
    return this.#valueMap.has(key as any) || this.#flashMap.has(key as any)
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
  set<key extends keyof valueData>(key: key, value: valueData[key]): void {
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
