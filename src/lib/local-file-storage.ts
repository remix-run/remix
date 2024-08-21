import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

import { FileStorage } from "./file-storage.js";
import { LazyFileContent, LazyFile } from "./lazy-file.js";

type FileWithoutSize = Omit<File, "size">;

/**
 * A `FileStorage` that is backed by the local filesystem.
 *
 * Note: Keys have no correlation to file names on disk, so they may be any string including
 * characters that are not valid in file names. Additionally, individual `File` names have no
 * correlation to names of files on disk, so multiple files with the same name may be stored in the
 * same storage object.
 */
export class LocalFileStorage implements FileStorage {
  #directory: string;
  #metadata: FileMetadataIndex;

  /**
   * @param directory The directory where files are stored
   */
  constructor(directory: string) {
    try {
      let stat = fs.statSync(directory);

      if (!stat.isDirectory()) {
        throw new Error(`Path "${directory}" is not a directory`);
      }
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }

      fs.mkdirSync(directory, { recursive: true });
    }

    this.#directory = directory;
    this.#metadata = new FileMetadataIndex(
      path.join(directory, ".metadata.json")
    );
  }

  has(key: string): Promise<boolean> {
    return this.#metadata.has(key);
  }

  async put(key: string, file: FileWithoutSize): Promise<void> {
    let { name, size } = await createFile(this.#directory, file.stream());

    await this.#metadata.set(key, {
      file: name,
      name: file.name,
      size: size,
      type: file.type
    });
  }

  async get(key: string): Promise<File | null> {
    let metadata = await this.#metadata.get(key);

    if (metadata == null) {
      return null;
    }

    let file = path.join(this.#directory, metadata.file);
    let content: LazyFileContent = {
      byteLength: metadata.size,
      read(start, end) {
        return readFile(file, start, end);
      }
    };

    return new LazyFile(content, metadata.name, { type: metadata.type });
  }

  async remove(key: string): Promise<void> {
    let metadata = await this.#metadata.get(key);

    if (metadata == null) {
      return;
    }

    let file = path.join(this.#directory, metadata.file);
    try {
      await fsp.unlink(file);
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }
    }

    await this.#metadata.remove(key);
  }
}

function randomFilename(): string {
  return `${new Date().getTime().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
}

function createFile(
  directory: string,
  stream: ReadableStream<Uint8Array>
): Promise<{ name: string; size: number }> {
  let filename = randomFilename();
  let file = path.join(directory, filename);

  return new Promise((resolve, reject) => {
    fs.open(file, "w", async (error, fd) => {
      if (error) {
        if (error.code === "EEXIST") {
          // Try again with a different filename
          return resolve(createFile(directory, stream));
        } else {
          return reject(error);
        }
      }

      let writeStream = fs.createWriteStream(file, { fd });
      let bytesWritten = 0;

      try {
        for await (let chunk of stream) {
          writeStream.write(chunk);
          bytesWritten += chunk.length;
        }

        writeStream.end();

        resolve({ name: filename, size: bytesWritten });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function readFile(
  filename: string,
  start?: number,
  end = Infinity
): ReadableStream<Uint8Array> {
  let read = fs.createReadStream(filename, { start, end: end - 1 }).iterator();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      let { done, value } = await read.next();

      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    }
  });
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
      return JSON.parse(await fsp.readFile(this.#path, { encoding: "utf-8" }));
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
    typeof obj === "object" &&
    obj !== null &&
    "code" in obj &&
    (obj as NodeJS.ErrnoException).code === "ENOENT"
  );
}
