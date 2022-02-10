import type {
  SessionData,
  SessionStorage,
  SessionIdStorageStrategy
} from "../sessions";
import { createSessionStorage } from "../sessions";

let memoryStorageData: {
  map: Map<string, { data: SessionData; expires?: Date }>;
  uniqueId: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __memoryStorageData:
    | {
        map: Map<string, { data: SessionData; expires?: Date }>;
        uniqueId: number;
      }
    | undefined;
}

interface MemorySessionStorageOptions {
  /**
   * The Cookie used to store the session id on the client, or options used
   * to automatically create one.
   */
  cookie?: SessionIdStorageStrategy["cookie"];
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
  if (process.env.NODE_ENV === "production") {
    memoryStorageData = {
      map: new Map<string, { data: SessionData; expires?: Date }>(),
      uniqueId: 0
    };
  } else {
    if (!global.__memoryStorageData) {
      global.__memoryStorageData = {
        map: new Map<string, { data: SessionData; expires?: Date }>(),
        uniqueId: 0
      };
    }
    memoryStorageData = global.__memoryStorageData;
  }

  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      const id = (++memoryStorageData.uniqueId).toString();
      memoryStorageData.map.set(id, { data, expires });
      return id;
    },
    async readData(id) {
      if (memoryStorageData.map.has(id)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { data, expires } = memoryStorageData.map.get(id)!;

        if (!expires || expires > new Date()) {
          return data;
        }

        // Remove expired session data.
        if (expires) memoryStorageData.map.delete(id);
      }

      return null;
    },
    async updateData(id, data, expires) {
      memoryStorageData.map.set(id, { data, expires });
    },
    async deleteData(id) {
      memoryStorageData.map.delete(id);
    }
  });
}
