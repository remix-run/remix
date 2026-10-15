type Data = Record<string, unknown>;
export type SessionData<valueData extends Data = Data, flashData extends Data = Data> = [
    valueData,
    flashData
];
/**
 * A session persists data for a specific user across multiple requests to a server.
 */
export declare class Session<valueData extends Data = Data, flashData extends Data = Data> {
    #private;
    /**
     * @param id The session ID
     * @param initialData The initial session data
     */
    constructor(id?: string, initialData?: SessionData<valueData, flashData>);
    /**
     * The raw session data in a format suitable for storage.
     *
     * Note: Do not use this for normal reading of session data. Use the `get` method instead.
     */
    get data(): SessionData<valueData, flashData>;
    /**
     * The session ID that will be deleted when the session is saved. This is set to the original
     * session ID when the session ID is regenerated with the `deleteOldSession` option.
     */
    get deleteId(): string | undefined;
    /**
     * Mark this session as destroyed.
     *
     * This prevents all further modifications to the session.
     */
    destroy(): void;
    /**
     * Whether this session has been destroyed.
     */
    get destroyed(): boolean;
    /**
     * Whether this session has been modified since it was created.
     */
    get dirty(): boolean;
    /**
     * Set a value in the session that will be available only during the next request.
     * @param key The key of the value to flash
     * @param value The value to flash
     */
    flash<key extends keyof flashData>(key: key, value: flashData[key]): void;
    /**
     * Get a value from the session.
     *
     * @param key The key of the value to get
     * @returns The value for the given key
     */
    get<key extends keyof valueData>(key: key): valueData[key] | undefined;
    get<key extends keyof flashData>(key: key): flashData[key] | undefined;
    get(key: string): undefined;
    /**
     * Check if a value is stored for the given key.
     *
     * @param key The key to check
     * @returns `true` if a value is stored for the given key, `false` otherwise
     */
    has(key: keyof valueData | keyof flashData): boolean;
    /**
     * The unique identifier for this session.
     */
    get id(): string;
    /**
     * Regenerate the session ID while preserving the session data. This should be called after login
     * or other privilege changes.
     *
     * @param deleteOldSession Whether to delete the old session data when the session is saved (default: `false`)
     */
    regenerateId(deleteOldSession?: boolean): void;
    /**
     * Set a value in the session.
     * @param key The key of the value to set
     * @param value The value to set
     */
    set<key extends keyof valueData>(key: key, value: valueData[key]): void;
    /**
     * The number of key/value pairs in the session.
     */
    get size(): number;
    /**
     * Remove a value from the session.
     * @param key The key of the value to remove
     */
    unset(key: keyof valueData): void;
}
/**
 * Create a new session.
 *
 * @param id The ID of the session
 * @param initialData The initial data for the session
 * @returns The new session
 */
export declare function createSession<valueData extends Data = Data, flashData extends Data = Data>(id?: string, initialData?: SessionData<valueData, flashData>): Session<valueData, flashData>;
/**
 * Create a new cryptographically secure session ID.
 *
 * @returns A new session ID
 */
export declare function createSessionId(): string;
export {};
//# sourceMappingURL=session.d.ts.map