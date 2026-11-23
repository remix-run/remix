export interface SearchFunction {
  (haystack: Uint8Array, start?: number): number
}

export function encodeAsciiPattern(pattern: string): Uint8Array {
  let bytes = new Uint8Array(pattern.length)
  for (let index = 0; index < pattern.length; ++index) {
    bytes[index] = pattern.charCodeAt(index) & 0xff
  }

  return bytes
}

export function createSearch(pattern: string): SearchFunction {
  let needle = encodeAsciiPattern(pattern)

  let search: SearchFunction
  // Use the built-in Buffer.indexOf method on Node.js and Bun for better perf.
  let BufferClass = (globalThis as any).Buffer as
    | { prototype: { indexOf(this: Uint8Array, needle: Uint8Array, start: number): number } }
    | undefined
  if (BufferClass && !('Deno' in globalThis)) {
    search = (haystack, start = 0) => BufferClass.prototype.indexOf.call(haystack, needle, start)
  } else {
    // KMP uses prefix lengths to resume partial matches after a mismatch.
    // Each prefix entry is the length of the longest proper prefix that is also a suffix.
    let prefixes = new Uint32Array(needle.length)
    for (let i = 1, matched = 0; i < needle.length; ++i) {
      while (matched > 0 && needle[i] !== needle[matched]) {
        matched = prefixes[matched - 1]
      }
      if (needle[i] === needle[matched]) ++matched
      prefixes[i] = matched
    }

    search = (haystack, start = 0) => {
      for (let i = start, matched = 0; i < haystack.length; ++i) {
        let byte = haystack[i]
        while (matched > 0 && byte !== needle[matched]) {
          matched = prefixes[matched - 1]
        }
        if (byte === needle[matched]) {
          if (++matched === needle.length) return i - matched + 1
        }
      }

      return -1
    }
  }

  return search
}

export interface PartialTailSearchFunction {
  (haystack: Uint8Array): number
}

export function createPartialTailSearch(pattern: string): PartialTailSearchFunction {
  let needle = encodeAsciiPattern(pattern)

  let byteIndexes: Record<number, number[]> = {}
  for (let i = 0; i < needle.length; ++i) {
    let byte = needle[i]
    if (byteIndexes[byte] === undefined) byteIndexes[byte] = []
    byteIndexes[byte].push(i)
  }

  return function (haystack: Uint8Array): number {
    let haystackEnd = haystack.length - 1

    if (haystack[haystackEnd] in byteIndexes) {
      let indexes = byteIndexes[haystack[haystackEnd]]

      for (let i = indexes.length - 1; i >= 0; --i) {
        for (let j = indexes[i], k = haystackEnd; j >= 0 && haystack[k] === needle[j]; --j, --k) {
          if (j === 0) return k
        }
      }
    }

    return -1
  }
}
