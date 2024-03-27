import type {
  SessionStorage,
  SessionIdStorageStrategy,
  SessionData,
} from "../sessions";

interface CookieSessionStorageOptions {
  /**
   * The Cookie used to store the session data on the client, or options used
   * to automatically create one.
   */
  cookie?: SessionIdStorageStrategy["cookie"];
}

export type CreateCookieSessionStorageFunction = <
  Data = SessionData,
  FlashData = Data
>(
  options?: CookieSessionStorageOptions
) => SessionStorage<Data, FlashData>;
