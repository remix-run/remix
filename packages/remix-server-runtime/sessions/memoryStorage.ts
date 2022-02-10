import type {
  SessionData,
  SessionStorage,
  SessionIdStorageStrategy,
  CreateSessionStorageFunction,
} from "../sessions";

let memoryStorageData: {
  map: Map<string, { data: SessionData; expires?: Date }>;
  uniqueId: number;
};

declare global {
  // eslint-disable-next-line prefer-let/prefer-let
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

export type CreateMemorySessionStorageFunction = (
  options?: MemorySessionStorageOptions
) => SessionStorage;

/**
 * Creates and returns a simple in-memory SessionStorage object, mostly useful
 * for testing and as a reference implementation.
 *
 * Note: This storage does not scale beyond a single process, so it is not
 * suitable for most production scenarios.
 *
 * @see https://remix.run/api/remix#creatememorysessionstorage
 */
export const createMemorySessionStorageFactory =
  (
    createSessionStorage: CreateSessionStorageFunction
  ): CreateMemorySessionStorageFunction =>
  ({ cookie } = {}) => {
    if (process.env.NODE_ENV === "production") {
      memoryStorageData = {
        map: new Map<string, { data: SessionData; expires?: Date }>(),
        uniqueId: 0,
      };
    } else {
      if (!global.__memoryStorageData) {
        global.__memoryStorageData = {
          map: new Map<string, { data: SessionData; expires?: Date }>(),
          uniqueId: 0,
        };
      }
      memoryStorageData = global.__memoryStorageData;
    }

    return createSessionStorage({
      cookie,
      async createData(data, expires) {
        let id = (++memoryStorageData.uniqueId).toString();
        memoryStorageData.map.set(id, { data, expires });
        return id;
      },
      async readData(id) {
        if (memoryStorageData.map.has(id)) {
          let { data, expires } = memoryStorageData.map.get(id)!;

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
      },
    });
  };
