import type {
  SessionData,
  SessionStorage,
  CookieIdSessionStorageStrategy
} from "../sessions";
import { createSessionStorage } from "../sessions";

interface MemorySessionStorageOptions {
  /**
   * The Cookie used to store the session id on the client, or options used
   * to automatically create one.
   */
  cookie?: CookieIdSessionStorageStrategy["cookie"];
}

/**
 * Creates and returns a simple in-memory SessionStorage object, mostly useful
 * for testing and as a reference implementation.
 *
 * Note: This storage does not scale beyond a single process, so it is not
 * suitable for most production scenarios.
 */
export function createMemorySessionStorage({
  cookie
}: MemorySessionStorageOptions = {}): SessionStorage {
  let uniqueId = 0;
  let map = new Map<string, SessionData>();

  return createSessionStorage({
    cookie,
    async createData(data) {
      let id = (++uniqueId).toString();
      map.set(id, data);
      return id;
    },
    async readData(id) {
      return map.get(id) || null;
    },
    async updateData(id, data) {
      map.set(id, data);
    },
    async deleteData(id) {
      map.delete(id);
    }
  });
}
