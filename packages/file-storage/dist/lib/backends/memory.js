/**
 * Creates a simple, in-memory implementation of the `FileStorage` interface.
 * @returns A new in-memory file storage instance
 */
export function createMemoryFileStorage() {
    let map = new Map();
    async function putFile(key, file) {
        let buffer = await file.arrayBuffer();
        let newFile = new File([buffer], file.name, {
            lastModified: file.lastModified,
            type: file.type,
        });
        map.set(key, newFile);
        return newFile;
    }
    return {
        get(key) {
            return map.get(key) ?? null;
        },
        has(key) {
            return map.has(key);
        },
        list(options) {
            let { cursor, includeMetadata = false, limit = Infinity, prefix } = options ?? {};
            let files = [];
            let foundCursor = cursor === undefined;
            let nextCursor;
            for (let [key, file] of map.entries()) {
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
                    }
                    else {
                        files.push({ key });
                    }
                }
                else if (key === cursor) {
                    foundCursor = true;
                }
            }
            return {
                cursor: nextCursor,
                files,
            };
        },
        put(key, file) {
            return putFile(key, file);
        },
        remove(key) {
            map.delete(key);
        },
        async set(key, file) {
            await putFile(key, file);
        },
    };
}
