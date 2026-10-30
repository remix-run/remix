/**
 * A session persists data for a specific user across multiple requests to a server.
 */
export class Session {
    #originalId;
    #currentId;
    #deleteId = undefined;
    #valueMap;
    #flashMap;
    #nextMap;
    #destroyed = false;
    #dirty;
    /**
     * @param id The session ID
     * @param initialData The initial session data
     */
    constructor(id = createSessionId(), initialData) {
        this.#originalId = id;
        this.#currentId = id;
        this.#valueMap = toMap(initialData?.[0]);
        this.#flashMap = toMap(initialData?.[1]);
        this.#nextMap = new Map();
        // Mark as dirty if flash data exists so it gets cleared on save
        this.#dirty = this.#flashMap.size > 0;
    }
    #checkDestroyed() {
        if (this.#destroyed)
            throw new Error('Session has been destroyed');
    }
    /**
     * The raw session data in a format suitable for storage.
     *
     * Note: Do not use this for normal reading of session data. Use the `get` method instead.
     */
    get data() {
        return (this.#destroyed
            ? [{}, {}]
            : [Object.fromEntries(this.#valueMap), Object.fromEntries(this.#nextMap)]);
    }
    /**
     * The session ID that will be deleted when the session is saved. This is set to the original
     * session ID when the session ID is regenerated with the `deleteOldSession` option.
     */
    get deleteId() {
        return this.#deleteId;
    }
    /**
     * Mark this session as destroyed.
     *
     * This prevents all further modifications to the session.
     */
    destroy() {
        this.#destroyed = true;
    }
    /**
     * Whether this session has been destroyed.
     */
    get destroyed() {
        return this.#destroyed;
    }
    /**
     * Whether this session has been modified since it was created.
     */
    get dirty() {
        return this.#dirty;
    }
    /**
     * Set a value in the session that will be available only during the next request.
     * @param key The key of the value to flash
     * @param value The value to flash
     */
    flash(key, value) {
        this.#checkDestroyed();
        this.#nextMap.set(key, value);
        this.#dirty = true;
    }
    get(key) {
        if (this.#destroyed)
            return undefined;
        return this.#valueMap.get(key) ?? this.#flashMap.get(key);
    }
    /**
     * Check if a value is stored for the given key.
     *
     * @param key The key to check
     * @returns `true` if a value is stored for the given key, `false` otherwise
     */
    has(key) {
        if (this.#destroyed)
            return false;
        return this.#valueMap.has(key) || this.#flashMap.has(key);
    }
    /**
     * The unique identifier for this session.
     */
    get id() {
        return this.#currentId;
    }
    /**
     * Regenerate the session ID while preserving the session data. This should be called after login
     * or other privilege changes.
     *
     * @param deleteOldSession Whether to delete the old session data when the session is saved (default: `false`)
     */
    regenerateId(deleteOldSession = false) {
        this.#checkDestroyed();
        if (deleteOldSession)
            this.#deleteId = this.#originalId;
        this.#currentId = createSessionId();
        this.#dirty = true;
    }
    /**
     * Set a value in the session.
     * @param key The key of the value to set
     * @param value The value to set
     */
    set(key, value) {
        this.#checkDestroyed();
        if (value == null) {
            this.#valueMap.delete(key);
        }
        else {
            this.#valueMap.set(key, value);
        }
        this.#dirty = true;
    }
    /**
     * The number of key/value pairs in the session.
     */
    get size() {
        if (this.#destroyed)
            return 0;
        return this.#valueMap.size + this.#flashMap.size;
    }
    /**
     * Remove a value from the session.
     * @param key The key of the value to remove
     */
    unset(key) {
        this.#checkDestroyed();
        this.#valueMap.delete(key);
        this.#dirty = true;
    }
}
function toMap(data) {
    if (!data)
        return new Map();
    return new Map(Object.entries(data));
}
/**
 * Create a new session.
 *
 * @param id The ID of the session
 * @param initialData The initial data for the session
 * @returns The new session
 */
export function createSession(id = createSessionId(), initialData) {
    return new Session(id, initialData);
}
/**
 * Create a new cryptographically secure session ID.
 *
 * @returns A new session ID
 */
export function createSessionId() {
    return crypto.randomUUID();
}
