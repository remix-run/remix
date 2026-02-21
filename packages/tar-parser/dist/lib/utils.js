export function buffersEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
export function concatChunks(a, b) {
    let result = new Uint8Array(a.length + b.length);
    result.set(a);
    result.set(b, a.length);
    return result;
}
export function computeChecksum(block) {
    let sum = 8 * 32;
    for (let i = 0; i < 148; i++)
        sum += block[i];
    for (let i = 156; i < 512; i++)
        sum += block[i];
    return sum;
}
export function decodeLongPath(buffer) {
    return Utf8Decoder.decode(buffer);
}
export function decodePax(buffer) {
    let pax = {};
    while (buffer.length) {
        let i = 0;
        while (i < buffer.length && buffer[i] !== 32)
            i++;
        let len = parseInt(Utf8Decoder.decode(buffer.subarray(0, i)), 10);
        if (!len)
            break;
        let val = Utf8Decoder.decode(buffer.subarray(i + 1, len - 1));
        let eq = val.indexOf('=');
        if (eq === -1)
            break;
        pax[val.slice(0, eq)] = val.slice(eq + 1);
        buffer = buffer.subarray(len);
    }
    return pax;
}
export function indexOf(buffer, value, offset, end) {
    for (; offset < end; offset++) {
        if (buffer[offset] === value)
            return offset;
    }
    return end;
}
export function getString(buffer, offset, size, label = 'utf-8') {
    return new TextDecoder(label).decode(buffer.subarray(offset, indexOf(buffer, 0, offset, offset + size)));
}
const Utf8Decoder = new TextDecoder();
export function getOctal(buffer, offset, size) {
    let value = buffer.subarray(offset, offset + size);
    offset = 0;
    if (value[offset] & 0x80)
        return parse256(value);
    // Older versions of tar can prefix with spaces
    while (offset < value.length && value[offset] === 32)
        offset++;
    let end = clamp(indexOf(value, 32, offset, value.length), value.length, value.length);
    while (offset < end && value[offset] === 0)
        offset++;
    if (end === offset)
        return 0;
    return parseInt(Utf8Decoder.decode(value.subarray(offset, end)), 8);
}
function clamp(index, len, defaultValue) {
    if (typeof index !== 'number')
        return defaultValue;
    index = ~~index; // Coerce to integer.
    if (index >= len)
        return len;
    if (index >= 0)
        return index;
    index += len;
    if (index >= 0)
        return index;
    return 0;
}
/* Copied from the tar-stream repo who copied it from the node-tar repo.
 */
function parse256(buf) {
    // first byte MUST be either 80 or FF
    // 80 for positive, FF for 2's comp
    let positive;
    if (buf[0] === 0x80)
        positive = true;
    else if (buf[0] === 0xff)
        positive = false;
    else
        return null;
    // build up a base-256 tuple from the least sig to the highest
    let tuple = [];
    let i;
    for (i = buf.length - 1; i > 0; i--) {
        let byte = buf[i];
        if (positive)
            tuple.push(byte);
        else
            tuple.push(0xff - byte);
    }
    let sum = 0;
    let len = tuple.length;
    for (i = 0; i < len; i++) {
        sum += tuple[i] * Math.pow(256, i);
    }
    return positive ? sum : -1 * sum;
}
export function overflow(size) {
    size &= 511;
    return size && 512 - size;
}
