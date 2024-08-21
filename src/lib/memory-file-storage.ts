import { type FileStorage } from "./file-storage.js";

/**
 * A simple, in-memory implementation of the `FileStorage` interface.
 */
export class MemoryFileStorage implements FileStorage {
  #files = new Map<string, File>();

  has(key: string): boolean {
    return this.#files.has(key);
  }

  put(key: string, file: File): void {
    this.#files.set(key, file);
  }

  get(key: string): File | null {
    return this.#files.get(key) ?? null;
  }

  remove(key: string): void {
    this.#files.delete(key);
  }
}
