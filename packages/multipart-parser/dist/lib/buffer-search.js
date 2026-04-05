export function createSearch(pattern) {
    let needle = new TextEncoder().encode(pattern);
    let search;
    // Use the built-in Buffer.indexOf method on Node.js for better perf.
    let BufferClass = globalThis.Buffer;
    if (BufferClass && !('Bun' in globalThis || 'Deno' in globalThis)) {
        search = (haystack, start = 0) => BufferClass.prototype.indexOf.call(haystack, needle, start);
    }
    else {
        let needleEnd = needle.length - 1;
        let skipTable = new Uint8Array(256).fill(needle.length);
        for (let i = 0; i < needleEnd; ++i) {
            skipTable[needle[i]] = needleEnd - i;
        }
        search = (haystack, start = 0) => {
            let haystackLength = haystack.length;
            let i = start + needleEnd;
            while (i < haystackLength) {
                for (let j = needleEnd, k = i; j >= 0 && haystack[k] === needle[j]; --j, --k) {
                    if (j === 0)
                        return k;
                }
                i += skipTable[haystack[i]];
            }
            return -1;
        };
    }
    return search;
}
export function createPartialTailSearch(pattern) {
    let needle = new TextEncoder().encode(pattern);
    let byteIndexes = {};
    for (let i = 0; i < needle.length; ++i) {
        let byte = needle[i];
        if (byteIndexes[byte] === undefined)
            byteIndexes[byte] = [];
        byteIndexes[byte].push(i);
    }
    return function (haystack) {
        let haystackEnd = haystack.length - 1;
        if (haystack[haystackEnd] in byteIndexes) {
            let indexes = byteIndexes[haystack[haystackEnd]];
            for (let i = indexes.length - 1; i >= 0; --i) {
                for (let j = indexes[i], k = haystackEnd; j >= 0 && haystack[k] === needle[j]; --j, --k) {
                    if (j === 0)
                        return k;
                }
            }
        }
        return -1;
    };
}
