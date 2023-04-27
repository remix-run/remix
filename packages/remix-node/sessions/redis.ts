import type {
  SessionData,
  SessionIdStorageStrategy,
  SessionStorage,
} from "@remix-run/server-runtime";
import type { Redis } from "ioredis";

import { createSessionStorage } from "../implementations";

interface RedisSessionStorageOptions {
  cookie?: SessionIdStorageStrategy["cookie"];
  redis: Redis;
}

export function createRedisSessionStorage<
  Data = SessionData,
  FlashData = Data
>({
  cookie,
  redis,
}: RedisSessionStorageOptions): SessionStorage<Data, FlashData> {
  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      let id = Math.random().toString(36).substring(2);
      await redis.set(id, JSON.stringify(data));
      if (expires) {
        await redis.expireat(id, Math.floor(expires.getTime() / 1000));
      }
      return id;
    },

    async readData(id) {
      let data = await redis.get(id);
      if (!data) return null;
      return JSON.parse(data);
    },

    async updateData(id, data, expires) {
      await redis.set(id, JSON.stringify(data));
      if (expires) {
        await redis.expireat(id, Math.floor(expires.getTime() / 1000));
      }
    },

    async deleteData(id) {
      await redis.del(id);
    },
  });
}
