import type { FileStorage, ListOptions, ListResult } from '../file-storage.ts'

/**
 * Creates a simple, in-memory implementation of the `FileStorage` interface.
 * @returns A new in-memory file storage instance
 */
export function createMemoryFileStorage(): FileStorage {
  let map = new Map<string, File>()

  async function putFile(key: string, file: File): Promise<File> {
    let buffer = await file.arrayBuffer()
    let newFile = new File([buffer], file.name, {
      lastModified: file.lastModified,
      type: file.type,
    })
    map.set(key, newFile)
    return newFile
  }

  return {
    get(key: string): File | null {
      return map.get(key) ?? null
    },
    has(key: string): boolean {
      return map.has(key)
    },
    list<opts extends ListOptions>(options?: opts): ListResult<opts> {
      let { cursor, includeMetadata = false, limit = Infinity, prefix } = options ?? {}

      let files: any[] = []
      let foundCursor = cursor === undefined
      let nextCursor: string | undefined

      for (let [key, file] of map.entries()) {
        if (foundCursor) {
          if (prefix != null && !key.startsWith(prefix)) {
            continue
          }

          if (files.length >= limit) {
            nextCursor = files[files.length - 1]?.key
            break
          }

          if (includeMetadata) {
            files.push({
              key,
              lastModified: file.lastModified,
              name: file.name,
              size: file.size,
              type: file.type,
            })
          } else {
            files.push({ key })
          }
        } else if (key === cursor) {
          foundCursor = true
        }
      }

      return {
        cursor: nextCursor,
        files,
      }
    },
    put(key: string, file: File): Promise<File> {
      return putFile(key, file)
    },
    remove(key: string): void {
      map.delete(key)
    },
    async set(key: string, file: File): Promise<void> {
      await putFile(key, file)
    },
  }
}
