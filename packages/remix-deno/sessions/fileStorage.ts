import * as path from "https://deno.land/std@0.128.0/path/mod.ts";

import type {
  SessionData,
  SessionIdStorageStrategy,
  SessionStorage,
} from "@remix-run/server-runtime";
import { createSessionStorage } from "../implementations.ts";

interface FileSessionStorageOptions {
  /**
   * The Cookie used to store the session id on the client, or options used
   * to automatically create one.
   */
  cookie?: SessionIdStorageStrategy["cookie"];

  /**
   * The directory to use to store session files.
   */
  dir: string;
}

/**
 * Creates a SessionStorage that stores session data on a filesystem.
 *
 * The advantage of using this instead of cookie session storage is that
 * files may contain much more data than cookies.
 */
export function createFileSessionStorage<Data = SessionData, FlashData = Data>({
  cookie,
  dir,
}: FileSessionStorageOptions): SessionStorage<Data, FlashData> {
  return createSessionStorage({
    cookie,
    createData: async (data, expires) => {
      const content = JSON.stringify({ data, expires });

      while (true) {
        const randomBytes = crypto.getRandomValues(new Uint8Array(8));

        // This storage manages an id space of 2^64 ids, which is far greater
        // than the maximum number of files allowed on an NTFS or ext4 volume
        // (2^32). However, the larger id space should help to avoid collisions
        // with existing ids when creating new sessions, which speeds things up.
        let id = "";
        for (let i = 0; i < randomBytes.length; ++i) {
          id += ("0" + randomBytes[i].toString(16)).slice(-2);
        }

        try {
          const file = getFile(dir, id);
          const exists = await Deno.stat(file)
            .then((s) => s.isFile)
            .catch(() => false);
          if (exists) continue;

          await Deno.mkdir(path.dirname(file), { recursive: true }).catch(
            () => {},
          );
          await Deno.writeFile(file, new TextEncoder().encode(content));

          return id;
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      }
    },
    readData: async (id) => {
      try {
        const file = getFile(dir, id);
        const content = JSON.parse(await Deno.readTextFile(file));
        const data = content.data;
        const expires = typeof content.expires === "string"
          ? new Date(content.expires)
          : null;

        if (!expires || expires > new Date()) {
          return data;
        }

        // Remove expired session data.
        if (expires) await Deno.remove(file);

        return null;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        return null;
      }
    },
    updateData: async (id, data, expires) => {
      const content = JSON.stringify({ data, expires });
      const file = getFile(dir, id);
      await Deno.mkdir(path.dirname(file), { recursive: true }).catch(() => {});
      await Deno.writeTextFile(file, content);
    },
    deleteData: async (id) => {
      try {
        await Deno.remove(getFile(dir, id));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    },
  });
}

function getFile(dir: string, id: string): string {
  // Divide the session id up into a directory (first 2 bytes) and filename
  // (remaining 6 bytes) to reduce the chance of having very large directories,
  // which should speed up file access. This is a maximum of 2^16 directories,
  // each with 2^48 files.
  return path.join(dir, id.slice(0, 4), id.slice(4));
}
