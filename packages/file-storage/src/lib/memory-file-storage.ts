import { FileStorage } from "./file-storage.js";

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

  remove(key: string): void {
    this.#map.delete(key);
  }
}
