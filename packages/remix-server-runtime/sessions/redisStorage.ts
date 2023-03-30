import type { Redis } from "ioredis";
import type {
  CreateSessionStorageFunction,
  SessionData,
  SessionIdStorageStrategy,
  SessionStorage,
} from "@remix-run/server-runtime";

interface RedisSessionStorageOptions {
  cookie?: SessionIdStorageStrategy["cookie"];
  redis: Redis;
}

export type CreateRedisSessionStorageFunction = <
  Data = SessionData,
  FlashData = Data
>(
  options: RedisSessionStorageOptions
) => SessionStorage<Data, FlashData>;

function generateSessionId(): string {
  return Math.random().toString(36).substring(2);
}

export const createRedisSessionStorageFactory =
  (
    createSessionStorage: CreateSessionStorageFunction
  ): CreateRedisSessionStorageFunction =>
  <Data = SessionData, FlashData = Data>({
    redis,
    cookie,
  }: RedisSessionStorageOptions): SessionStorage<Data, FlashData> => {
    return createSessionStorage({
      cookie,
      async createData(data, expires) {
        let id = generateSessionId();
        if (expires) {
          await redis.set(id, JSON.stringify(data), "EX", expires.getSeconds());
        } else {
          await redis.set(id, JSON.stringify(data));
        }
        return id;
      },

      async readData(id) {
        let data = await redis.get(id);
        if (!data) return null;
        return JSON.parse(data);
      },

      async updateData(id, data, expires) {
        if (expires) {
          await redis.set(id, JSON.stringify(data), "EX", expires.getSeconds());
        } else {
          await redis.set(id, JSON.stringify(data));
        }
      },

      async deleteData(id) {
        await redis.del(id);
      },
    });
  };
