import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { openFile, writeFile } from '@mjackson/lazy-file/fs';

import type { FileStorage, FileMetadata, ListOptions, ListResult } from './file-storage.ts';

type MetadataJson = Omit<FileMetadata, 'size'>;

/**
 * A `FileStorage` that is backed by a directory on the local filesystem.
 *
 * Important: No attempt is made to avoid overwriting existing files, so the directory used should
 * be a new directory solely dedicated to this storage object.
 *
 * Note: Keys have no correlation to file names on disk, so they may be any string including
 * characters that are not valid in file names. Additionally, individual `File` names have no
 * correlation to names of files on disk, so multiple files with the same name may be stored in the
 * same storage object.
 */
export class LocalFileStorage implements FileStorage {
  #dirname: string;

  /**
   * @param directory The directory where files are stored
   */
  constructor(directory: string) {
    this.#dirname = path.resolve(directory);

    try {
      let stats = fs.statSync(this.#dirname);

      if (!stats.isDirectory()) {
        throw new Error(`Path "${this.#dirname}" is not a directory`);
      }
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }

      fs.mkdirSync(this.#dirname, { recursive: true });
    }
  }

  async get(key: string): Promise<File | null> {
    let { filePath, metaPath } = await this.#getPaths(key);

    try {
      let meta = await readMetadata(metaPath);

      return openFile(filePath, {
        lastModified: meta.lastModified,
        name: meta.name,
        type: meta.type,
      });
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }

      return null;
    }
  }

  async has(key: string): Promise<boolean> {
    let { metaPath } = await this.#getPaths(key);

    try {
      await fsp.access(metaPath);
      return true;
    } catch {
      return false;
    }
  }

  async list<T extends ListOptions>(options?: T): Promise<ListResult<T>> {
    let { cursor, includeMetadata = false, limit = 32, prefix } = options ?? {};

    let files: any[] = [];
    let foundCursor = cursor === undefined;
    let nextCursor: string | undefined;
    let lastHash: string | undefined;

    outerLoop: for await (let subdir of await fsp.opendir(this.#dirname)) {
      if (!subdir.isDirectory()) continue;

      for await (let file of await fsp.opendir(path.join(this.#dirname, subdir.name))) {
        if (!file.isFile() || !file.name.endsWith('.meta.json')) continue;

        let hash = file.name.slice(0, -10); // Remove ".meta.json"

        if (foundCursor) {
          let meta = await readMetadata(path.join(this.#dirname, subdir.name, file.name));

          if (prefix != null && !meta.key.startsWith(prefix)) {
            continue;
          }

          if (files.length >= limit) {
            nextCursor = lastHash;
            break outerLoop;
          }

          if (includeMetadata) {
            let size = (await fsp.stat(path.join(this.#dirname, subdir.name, `${hash}.dat`))).size;
            files.push({ ...meta, size });
          } else {
            files.push({ key: meta.key });
          }
        } else if (hash === cursor) {
          foundCursor = true;
        }

        lastHash = hash;
      }
    }

    return {
      cursor: nextCursor,
      files,
    };
  }

  async put(key: string, file: File): Promise<File> {
    await this.set(key, file);
    return (await this.get(key))!;
  }

  async remove(key: string): Promise<void> {
    let { filePath, metaPath } = await this.#getPaths(key);

    try {
      await Promise.all([fsp.unlink(filePath), fsp.unlink(metaPath)]);
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }
    }
  }

  async set(key: string, file: File): Promise<void> {
    // Remove any existing file with the same key.
    await this.remove(key);

    let { directory, filePath, metaPath } = await this.#getPaths(key);

    // Ensure directory exists
    await fsp.mkdir(directory, { recursive: true });

    await writeFile(filePath, file);

    let meta: MetadataJson = {
      key,
      lastModified: file.lastModified,
      name: file.name,
      type: file.type,
    };
    await fsp.writeFile(metaPath, JSON.stringify(meta));
  }

  async #getPaths(key: string): Promise<{ directory: string; filePath: string; metaPath: string }> {
    let hash = await computeHash(key);
    let directory = path.join(this.#dirname, hash.slice(0, 2));

    return {
      directory,
      filePath: path.join(directory, `${hash}.dat`),
      metaPath: path.join(directory, `${hash}.meta.json`),
    };
  }
}

async function readMetadata(metaPath: string): Promise<MetadataJson> {
  return JSON.parse(await fsp.readFile(metaPath, 'utf-8'));
}

async function computeHash(key: string, algorithm = 'SHA-256'): Promise<string> {
  let digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function isNoEntityError(obj: unknown): obj is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return obj instanceof Error && 'code' in obj && (obj as NodeJS.ErrnoException).code === 'ENOENT';
}
