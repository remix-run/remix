export interface BufferSearch {
  indexIn(haystack: Uint8Array): number;
  endPartialIndexIn(haystack: Uint8Array): number;
}

export function createSearch(pattern: string): BufferSearch {
  let needle = new TextEncoder().encode(pattern);
  let needleLength = needle.length;

  let indexIn: (haystack: Uint8Array) => number;
  if ('Buffer' in globalThis && !('Bun' in globalThis || 'Deno' in globalThis)) {
    // Use the built-in Buffer.indexOf method on Node.js for better perf.
    indexIn = (haystack) => Buffer.prototype.indexOf.call(haystack, needle);
  } else {
    let skipTable = new Uint8Array(256).fill(needleLength);
    for (let i = 0, end = needleLength - 1; i < end; ++i) {
      skipTable[needle[i]] = end - i;
    }

    indexIn = (haystack) => {
      let haystackLength = haystack.length;
      let i = needleLength - 1;

      while (i < haystackLength) {
        for (let j = needleLength - 1, k = i; j >= 0 && haystack[k] === needle[j]; --j, --k) {
          if (j === 0) return k;
        }

        i += skipTable[haystack[i]];
      }

      return -1;
    };
  }

  let byteIndexes: Record<number, number[]> = {};
  for (let i = 0; i < needleLength; ++i) {
    let byte = needle[i];
    if (byteIndexes[byte] === undefined) byteIndexes[byte] = [];
    byteIndexes[byte].push(i);
  }

  function endPartialIndexIn(haystack: Uint8Array): number {
    let end = haystack.length - 1;

    if (haystack[end] in byteIndexes) {
      let indexes = byteIndexes[haystack[end]];

      for (let i = indexes.length - 1; i >= 0; --i) {
        for (let j = indexes[i], k = end; j >= 0 && haystack[k] === needle[j]; --j, --k) {
          if (j === 0) return k;
        }
      }
    }

    return -1;
  }

  return { indexIn, endPartialIndexIn } as const;
}
