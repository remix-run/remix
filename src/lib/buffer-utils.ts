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

export function computeSkipTable(needle: Uint8Array): Uint8Array {
  let table = new Uint8Array(256).fill(needle.length);

  let lastIndex = needle.length - 1;
  for (let i = 0; i < lastIndex; ++i) {
    table[needle[i]] = lastIndex - i;
  }

  return table;
}

export function indexOf(
  haystack: Uint8Array,
  needle: Uint8Array,
  offset = 0,
  skipTable = computeSkipTable(needle),
): number {
  let i = Math.max(needle.length - 1, offset);

  while (i < haystack.length) {
    let j = needle.length - 1;
    let k = i;

    while (j >= 0 && haystack[k] === needle[j]) {
      j--;
      k--;
    }

    if (j === -1) {
      return k + 1;
    }

    i += skipTable[haystack[i]];
  }

  return -1; // Not found
}

export function combinedIndexOf(
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

    // This optimization is worthwhile when streaming large files because the head is
    // typically very small compared to the tail, so we can switch to a simpler implementation
    // once we are sure the boundary is not contained in the head (the parser's buffer) +
    // the beginning of the tail (the new chunk)
    if (i >= headLength + needle.length) {
      let index = indexOf(tail, needle, i - headLength, skipTable);
      return index === -1 ? -1 : index + headLength;
    }
  }

  return -1; // Not found
}
