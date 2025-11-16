type Data = Record<string, unknown>

export type SessionData<valueData extends Data = Data, flashData extends Data = Data> = [
  valueData,
  flashData,
]

/**
 * A session represents data that persists for a specific user across multiple requests to a server.
 */
export interface Session<valueData extends Data = Data, flashData extends Data = Data> {
  /**
   * The raw session data in a format suitable for storage.
   *
   * Note: Do not use this for normal reading of session data. Use the `get` method instead.
   */
  readonly data: SessionData<valueData, flashData>
  /**
   * The session ID that will be deleted when the session is saved. This is set to the original
   * session ID when the session ID is regenerated with the `deleteOldSession` option.
   */
  readonly deleteId: string | undefined
  /**
   * Mark this session as destroyed.
   *
   * This prevents all further modifications to the session.
   */
  destroy(): void
  /**
   * Whether this session has been destroyed.
   */
  readonly destroyed: boolean
  /**
   * Whether this session has been modified since it was created.
   */
  readonly dirty: boolean
  /**
   * Set a value in the session that will be available only during the next request.
   * @param key The key of the value to flash
   * @param value The value to flash
   */
  flash<key extends keyof flashData>(key: key, value: flashData[key]): void
  /**
   * Get a value from the session.
   * @param key The key of the value to get
   * @returns The value for the given key
   */
  get<key extends keyof valueData>(key: key): valueData[key] | undefined
  get<key extends keyof flashData>(key: key): flashData[key] | undefined
  get(key: string): undefined
  /**
   * Check if a value is stored for the given key.
   * @param key The key to check
   * @returns `true` if a value is stored for the given key, `false` otherwise
   */
  has(key: keyof valueData | keyof flashData): boolean
  /**
   * The unique identifier for this session.
   */
  readonly id: string
  /**
   * Regenerate the session ID while preserving the session data.
   * This should be called after login or other privilege changes.
   * @param deleteOldSession Whether to delete the old session data when the session is saved. Defaults to `false`.
   */
  regenerateId(deleteOldSession?: boolean): void
  /**
   * Set a value in the session.
   * @param key The key of the value to set
   * @param value The value to set
   */
  set<key extends keyof valueData>(key: key, value: valueData[key]): void
  /**
   * The number of key/value pairs in the session.
   */
  readonly size: number
  /**
   * Remove a value from the session.
   * @param key The key of the value to remove
   */
  unset(key: keyof valueData): void
}

/**
 * Create a new cryptographically secure session ID.
 * @returns A new session ID
 */
export function createSessionId(): string {
  return crypto.randomUUID()
}

/**
 * Create a new session.
 * @param id The ID of the session
 * @param initialData The initial data for the session
 * @returns The session
 */
export function createSession<valueData extends Data = Data, flashData extends Data = Data>(
  id = createSessionId(),
  initialData?: SessionData<valueData, flashData>,
): Session<valueData, flashData> {
  let currentId = id
  let deleteId: string | undefined = undefined
  let valueMap = toMap(initialData?.[0])
  let flashMap = toMap(initialData?.[1])
  let nextMap = new Map<keyof flashData, flashData[keyof flashData]>()
  let destroyed = false
  let dirty = false

  function checkDestroyed() {
    if (destroyed) throw new Error('Session has been destroyed')
  }

  return {
    get data() {
      return (
        destroyed ? [{}, {}] : [Object.fromEntries(valueMap), Object.fromEntries(nextMap)]
      ) as SessionData<valueData, flashData>
    },
    get deleteId() {
      return deleteId
    },
    destroy() {
      destroyed = true
    },
    get destroyed() {
      return destroyed
    },
    get dirty() {
      return dirty
    },
    flash(key, value) {
      checkDestroyed()
      nextMap.set(key, value)
      dirty = true
    },
    get(key: string) {
      if (destroyed) return undefined as any
      return valueMap.get(key as any) ?? flashMap.get(key as any)
    },
    has(key) {
      if (destroyed) return false
      return valueMap.has(key as any) || flashMap.has(key as any)
    },
    get id() {
      return currentId
    },
    regenerateId(deleteOldSession = false) {
      checkDestroyed()
      if (deleteOldSession) deleteId = id
      currentId = createSessionId()
      dirty = true
    },
    set(key, value) {
      checkDestroyed()
      if (value == null) {
        valueMap.delete(key as any)
      } else {
        valueMap.set(key as any, value)
      }
      dirty = true
    },
    get size() {
      if (destroyed) return 0
      return valueMap.size + flashMap.size
    },
    unset(key) {
      checkDestroyed()
      valueMap.delete(key as any)
      dirty = true
    },
  }
}

function toMap<data extends Data>(data?: data): Map<keyof data, data[keyof data]> {
  if (!data) return new Map()
  return new Map(Object.entries(data) as [keyof data, data[keyof data]][])
}
