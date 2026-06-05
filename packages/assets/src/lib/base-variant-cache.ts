interface BaseVariantRecord {
  identityPath: string
  invalidationVersion: number
}

export interface BaseVariantCache<record extends BaseVariantRecord, value> {
  get(record: record, basePathname: string, create: () => Promise<value>): Promise<value>
  prune(): void
}

export function createBaseVariantCache<record extends BaseVariantRecord, value>(options: {
  getRecord(identityPath: string): record
}): BaseVariantCache<record, value> {
  let valuesByCacheKey = new Map<string, value>()
  let inFlightByCacheKey = new Map<string, Promise<value>>()

  return {
    async get(record, basePathname, create) {
      let cacheKey = getBaseRecordCacheKey(record, basePathname)
      let startedVersion = record.invalidationVersion
      let cached = valuesByCacheKey.get(cacheKey)
      if (cached) return cached

      let existing = inFlightByCacheKey.get(cacheKey)
      if (existing) return existing

      let promise = create()
      inFlightByCacheKey.set(cacheKey, promise)

      try {
        let value = await promise
        if (record.invalidationVersion === startedVersion) {
          valuesByCacheKey.set(cacheKey, value)
        }
        return value
      } finally {
        if (inFlightByCacheKey.get(cacheKey) === promise) {
          inFlightByCacheKey.delete(cacheKey)
        }
      }
    },

    prune() {
      for (let cacheKey of valuesByCacheKey.keys()) {
        let cached = parseBaseRecordCacheKey(cacheKey)
        if (!cached) {
          valuesByCacheKey.delete(cacheKey)
          continue
        }

        if (
          options.getRecord(cached.identityPath).invalidationVersion !== cached.invalidationVersion
        ) {
          valuesByCacheKey.delete(cacheKey)
        }
      }
    },
  }
}

function getBaseRecordCacheKey(record: BaseVariantRecord, basePathname: string): string {
  return `${record.identityPath}\0${record.invalidationVersion}\0${basePathname}`
}

function parseBaseRecordCacheKey(
  cacheKey: string,
): { identityPath: string; invalidationVersion: number } | null {
  let firstSeparator = cacheKey.indexOf('\0')
  if (firstSeparator === -1) return null

  let secondSeparator = cacheKey.indexOf('\0', firstSeparator + 1)
  if (secondSeparator === -1) return null

  let invalidationVersion = Number(cacheKey.slice(firstSeparator + 1, secondSeparator))
  if (!Number.isSafeInteger(invalidationVersion)) return null

  return {
    identityPath: cacheKey.slice(0, firstSeparator),
    invalidationVersion,
  }
}
