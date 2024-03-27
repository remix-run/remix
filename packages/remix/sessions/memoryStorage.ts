import type {
  SessionData,
  SessionStorage,
  SessionIdStorageStrategy,
} from "../sessions";

interface MemorySessionStorageOptions {
  /**
   * The Cookie used to store the session id on the client, or options used
   * to automatically create one.
   */
  cookie?: SessionIdStorageStrategy["cookie"];
}

export type CreateMemorySessionStorageFunction = <
  Data = SessionData,
  FlashData = Data
>(
  options?: MemorySessionStorageOptions
) => SessionStorage<Data, FlashData>;
