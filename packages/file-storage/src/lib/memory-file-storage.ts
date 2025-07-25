import type { FileStorage, ListOptions, ListResult } from './file-storage.ts';

/**
 * A simple, in-memory implementation of the `FileStorage` interface.
 */
export class MemoryFileStorage implements FileStorage {
  #map = new Map<string, File>();

  get(key: string): File | null {
    return this.#map.get(key) ?? null;
  }

  has(key: string): boolean {
    return this.#map.has(key);
  }

  list<T extends ListOptions>(options?: T): ListResult<T> {
    let { cursor, includeMetadata = false, limit = Infinity, prefix } = options ?? {};

    let files: any[] = [];
    let foundCursor = cursor === undefined;
    let nextCursor: string | undefined;

    for (let [key, file] of this.#map.entries()) {
      if (foundCursor) {
        if (prefix != null && !key.startsWith(prefix)) {
          continue;
        }

        if (files.length >= limit) {
          nextCursor = files[files.length - 1]?.key;
          break;
        }

        if (includeMetadata) {
          files.push({
            key,
            lastModified: file.lastModified,
            name: file.name,
            size: file.size,
            type: file.type,
          });
        } else {
          files.push({ key });
        }
      } else if (key === cursor) {
        foundCursor = true;
      }
    }

    return {
      cursor: nextCursor,
      files,
    };
  }

  async put(key: string, file: File): Promise<File> {
    await this.set(key, file);
    return this.get(key)!;
  }

  remove(key: string): void {
    this.#map.delete(key);
  }

  async set(key: string, file: File): Promise<void> {
    let buffer = await file.arrayBuffer();
    let newFile = new File([buffer], file.name, {
      lastModified: file.lastModified,
      type: file.type,
    });

    this.#map.set(key, newFile);
  }
}
