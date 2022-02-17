import * as crypto from "crypto";
import type {
  SessionStorage,
  SessionIdStorageStrategy
} from "@remix-run/server-runtime";
import { createSessionStorage } from "@remix-run/server-runtime";
import arc from "@architect/functions";
import type { ArcTable } from "@architect/functions/tables";

interface ArcTableSessionStorageOptions {
  /**
   * The Cookie used to store the session id on the client, or options used
   * to automatically create one.
   */
  cookie?: SessionIdStorageStrategy["cookie"];

  /**
   * The table used to store sessions, or its name as it appears in your
   * project's app.arc file.
   */
  table: ArcTable | string;

  /**
   * The name of the DynamoDB attribute used to store the session ID.
   * This should be the table's partition key.
   */
  idx: string;

  /**
   * The name of the DynamoDB attribute used to store the expiration time.
   * If absent, then no TTL will be stored and session records will not expire.
   */
  ttl?: string;
}

/**
 * Session storage using a DynamoDB table managed by Architect.
 *
 * Add the following lines to your project's `app.arc` file:
 *
 *   @tables
 *   arc-sessions
 *     _idx *String
 *     _ttl TTL
 */
export function createArcTableSessionStorage({
  cookie,
  ...props
}: ArcTableSessionStorageOptions): SessionStorage {
  async function getTable() {
    if (typeof props.table === "string") {
      const tables = await arc.tables();
      return tables[props.table];
    } else {
      return props.table;
    }
  }
  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      const table = await getTable();
      while (true) {
        const randomBytes = crypto.randomBytes(8);
        // This storage manages an id space of 2^64 ids, which is far greater
        // than the maximum number of files allowed on an NTFS or ext4 volume
        // (2^32). However, the larger id space should help to avoid collisions
        // with existing ids when creating new sessions, which speeds things up.
        let id = [...randomBytes]
          .map(x => x.toString(16).padStart(2, "0"))
          .join("");

        if (await table.get({ [props.idx]: id })) {
          continue;
        }

        let params = {
          [props.idx]: id,
          ...data
        };
        if (props.ttl) {
          params[props.ttl] = expires
            ? Math.round(expires.getTime() / 1000)
            : undefined;
        }
        await table.put(params);

        return id;
      }
    },
    async readData(id) {
      const table = await getTable();
      let data = await table.get({ [props.idx]: id });
      if (data) {
        delete data[props.idx];
        if (props.ttl) delete data[props.ttl];
      }
      return data;
    },
    async updateData(id, data, expires) {
      const table = await getTable();
      let params = {
        [props.idx]: id,
        ...data
      };
      if (props.ttl) {
        params[props.ttl] = expires
          ? Math.round(expires.getTime() / 1000)
          : undefined;
      }
      await table.put(params);
    },
    async deleteData(id) {
      const table = await getTable();
      await table.delete({ [props.idx]: id });
    }
  });
}
