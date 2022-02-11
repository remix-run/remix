import * as crypto from "crypto";

import { createSessionStorage } from "remix";

const upstashRedisRestUrl = process.env.UPSTASH_REDIS_REST_URL;

const headers = {
  Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
  Accept: "application/json",
  "Content-Type": "application/json"
};

const expiresToSeconds = expires => {
  const now = new Date();
  const expiresDate = new Date(expires);
  const secondsDelta = Math.ceil(
    (expiresDate.getTime() - now.getTime()) / 1000
  );
  return secondsDelta < 0 ? 0 : secondsDelta;
};

// For more info check https://remix.run/api/remix#createsessionstorage
export function createUpstashSessionStorage({ cookie }: any) {
  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      // Create a random id - taken from the core `createFileSessionStorage` Remix function.
      const randomBytes = crypto.randomBytes(8);
      const id = Buffer.from(randomBytes).toString("hex");
      // Call Upstash Redis HTTP API. Set expiration according to the cookie `expired property.
      // Note the use of the `expiresToSeconds` that converts date to seconds.
      await fetch(
        `${upstashRedisRestUrl}/set/${id}?EX=${expiresToSeconds(expires)}`,
        {
          method: "post",
          body: JSON.stringify({ data }),
          headers
        }
      );
      return id;

    },
    async readData(id) {
      console.log(id);
      const response = await fetch(`${upstashRedisRestUrl}/get/${id}`, {
        headers
      });
      try {
        const { result } = await response.json();
        return JSON.parse(result).data;
      } catch (error) {
        return null;
      }
    },
    async updateData(id, data, expires) {
      await fetch(
        `${upstashRedisRestUrl}/set/${id}?EX=${expiresToSeconds(expires)}`,
        {
          method: "post",
          body: JSON.stringify({ data }),
          headers
        }
      );
    },
    async deleteData(id) {
      await fetch(`${upstashRedisRestUrl}/del/${id}`, {
        method: "post",
        headers
      });
    }
  });
}
