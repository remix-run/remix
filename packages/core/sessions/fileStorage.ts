import crypto from "crypto";
import { promises as fsp } from "fs";
import path from "path";

import type {
  SessionStorage,
  CookieIdSessionStorageStrategy
} from "../sessions";
import { createSessionStorage } from "../sessions";

interface FileSessionStorageOptions {
  /**
   * The Cookie used to store the session id on the client, or options used
   * to automatically create one.
   */
  cookie?: CookieIdSessionStorageStrategy["cookie"];

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
export function createFileSessionStorage({
  cookie,
  dir
}: FileSessionStorageOptions): SessionStorage {
  return createSessionStorage({
    cookie,
    async createData(data) {
      let content = JSON.stringify(data);

      while (true) {
        // This storage manages an id space of 2^64 ids, which is far greater
        // than the maximum number of files allowed on an NTFS or ext4 volume
        // (2^32). However, the larger id space should help to avoid collisions
        // with existing ids when creating new sessions, which speeds things up.
        let id = crypto.randomBytes(8).toString("hex");

        try {
          let file = getFile(dir, id);
          await fsp.mkdir(path.dirname(file), { recursive: true });
          await fsp.writeFile(file, content, { flag: "wx" });
          return id;
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      }
    },
    async readData(id) {
      try {
        return JSON.parse(await fsp.readFile(getFile(dir, id), "utf-8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        return null;
      }
    },
    async updateData(id, data) {
      let file = getFile(dir, id);
      await fsp.mkdir(path.dirname(file), { recursive: true });
      await fsp.writeFile(file, JSON.stringify(data));
    },
    async deleteData(id) {
      try {
        await fsp.unlink(getFile(dir, id));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  });
}

function getFile(dir: string, id: string): string {
  // Divide the session id up into a directory (first 2 bytes) and filename
  // (remaining 6 bytes) to reduce the chance of having very large directories,
  // which should speed up file access. This is a maximum of 2^16 directories,
  // each with 2^48 files.
  return path.join(dir, id.slice(0, 4), id.slice(4));
}
