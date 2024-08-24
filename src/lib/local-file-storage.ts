import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { getFile } from "@mjackson/lazy-file/fs";

import { FileStorage } from "./file-storage.js";

/**
 * A `FileStorage` that is backed by the local filesystem.
 *
 * Note: Keys have no correlation to file names on disk, so they may be any string including
 * characters that are not valid in file names. Additionally, individual `File` names have no
 * correlation to names of files on disk, so multiple files with the same name may be stored in the
 * same storage object.
 */
export class LocalFileStorage implements FileStorage {
  #dirname: string;
  #metadata: FileMetadataIndex;

  /**
   * @param directory The directory where files are stored
   */
  constructor(directory: string) {
    this.#dirname = path.resolve(directory);

    try {
      let stat = fs.statSync(this.#dirname);

      if (!stat.isDirectory()) {
        throw new Error(`Path "${this.#dirname}" is not a directory`);
      }
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }

      fs.mkdirSync(this.#dirname, { recursive: true });
    }

    this.#metadata = new FileMetadataIndex(
      path.join(directory, ".metadata.json")
    );
  }

  has(key: string): Promise<boolean> {
    return this.#metadata.has(key);
  }

  async set(key: string, file: File): Promise<void> {
    let localFile = await storeFile(this.#dirname, file);

    await this.#metadata.set(key, {
      file: localFile.name,
      name: file.name,
      size: localFile.size,
      type: file.type
    });
  }

  async get(key: string): Promise<File | null> {
    let metadata = await this.#metadata.get(key);
    if (metadata == null) return null;

    let filename = path.join(this.#dirname, metadata.file);
    return getFile(filename, { name: metadata.name, type: metadata.type });
  }

  async remove(key: string): Promise<void> {
    let metadata = await this.#metadata.get(key);
    if (metadata == null) return;

    let filename = path.join(this.#dirname, metadata.file);

    try {
      await fsp.unlink(filename);
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }
    }

    await this.#metadata.remove(key);
  }
}

async function storeFile(dirname: string, file: File): Promise<File> {
  let filename = path.join(dirname, randomFilename());

  let handle: fsp.FileHandle;
  try {
    handle = await fsp.open(filename, "w");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      // Try again with a different filename
      return storeFile(dirname, file);
    } else {
      throw error;
    }
  }

  try {
    for await (let chunk of file.stream()) {
      await handle.write(chunk);
    }
  } finally {
    await handle.close();
  }

  return getFile(filename);
}

function randomFilename(): string {
  return `${new Date().getTime().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
}

interface FileMetadata {
  file: string;
  name: string;
  size: number;
  type: string;
}

class FileMetadataIndex {
  #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  async #getAll(): Promise<Record<string, FileMetadata>> {
    try {
      return JSON.parse(await getFile(this.#path).text());
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }

      return {};
    }
  }

  async #save(info: Record<string, FileMetadata | undefined>): Promise<void> {
    await fsp.writeFile(this.#path, JSON.stringify(info));
  }

  async has(key: string): Promise<boolean> {
    let info = await this.#getAll();
    return key in info;
  }

  async set(key: string, metadata: FileMetadata): Promise<void> {
    let info = await this.#getAll();
    await this.#save({ ...info, [key]: metadata });
  }

  async get(key: string): Promise<FileMetadata | null> {
    let info = await this.#getAll();
    return info[key] ?? null;
  }

  async remove(key: string): Promise<void> {
    let info = await this.#getAll();
    await this.#save({ ...info, [key]: undefined });
  }
}

function isNoEntityError(
  obj: unknown
): obj is NodeJS.ErrnoException & { code: "ENOENT" } {
  return (
    obj instanceof Error &&
    "code" in obj &&
    (obj as NodeJS.ErrnoException).code === "ENOENT"
  );
}
