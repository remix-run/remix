import { type FileStorage } from './file-storage.ts';

/**
 * A simple, in-memory implementation of the `FileStorage` interface.
 */
export class MemoryFileStorage implements FileStorage {
  #map = new Map<string, File>();

  has(key: string): boolean {
    return this.#map.has(key);
  }

  set(key: string, file: File): void {
    this.#map.set(key, file);
  }

  get(key: string): File | null {
    return this.#map.get(key) ?? null;
  }

  put(key: string, file: File): File {
    this.set(key, file);
    return this.get(key)!;
  }

  remove(key: string): void {
    this.#map.delete(key);
  }
}
