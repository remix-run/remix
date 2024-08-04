export function concat(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];

  let length = 0;
  for (let chunk of chunks) {
    length += chunk.length;
  }

  let result = new Uint8Array(length);
  let offset = 0;

  for (let chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

export function indexOf(
  head: Uint8Array,
  tail: Uint8Array,
  needle: Uint8Array,
  skipTable = computeSkipTable(needle),
): number {
  let headLength = head.length;
  let totalLength = headLength + tail.length;
  let i = needle.length - 1;

  while (i < totalLength) {
    let j = needle.length - 1;
    let k = i;

    while (j >= 0 && (k < headLength ? head[k] : tail[k - headLength]) === needle[j]) {
      j--;
      k--;
    }

    if (j === -1) {
      return k + 1;
    }

    i += skipTable[i < headLength ? head[i] : tail[i - headLength]];
  }

  return -1; // Not found
}

export function computeSkipTable(needle: Uint8Array): Uint8Array {
  let table = new Uint8Array(256).fill(needle.length);
  let lastIndex = needle.length - 1;

  for (let i = 0; i < lastIndex; ++i) {
    table[needle[i]] = lastIndex - i;
  }

  return table;
}
