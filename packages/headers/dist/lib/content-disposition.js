import {} from "./header-value.js";
import { parseParams, quote } from "./param-values.js";
/**
 * The value of a `Content-Disposition` HTTP header.
 *
 * [MDN `Content-Disposition` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition)
 *
 * [RFC 6266](https://tools.ietf.org/html/rfc6266)
 */
export class ContentDisposition {
    filename;
    filenameSplat;
    name;
    type;
    constructor(init) {
        if (init)
            return ContentDisposition.from(init);
    }
    /**
     * The preferred filename for the content, using the `filename*` parameter if present, falling back to the `filename` parameter.
     *
     * From [RFC 6266](https://tools.ietf.org/html/rfc6266):
     *
     * Many user agent implementations predating this specification do not understand the "filename*" parameter.
     * Therefore, when both "filename" and "filename*" are present in a single header field value, recipients SHOULD
     * pick "filename*" and ignore "filename". This way, senders can avoid special-casing specific user agents by
     * sending both the more expressive "filename*" parameter, and the "filename" parameter as fallback for legacy recipients.
     */
    get preferredFilename() {
        let filenameSplat = this.filenameSplat;
        if (filenameSplat) {
            let decodedFilename = decodeFilenameSplat(filenameSplat);
            if (decodedFilename)
                return decodedFilename;
        }
        return this.filename;
    }
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString() {
        if (!this.type) {
            return '';
        }
        let parts = [this.type];
        if (this.name) {
            parts.push(`name=${quote(this.name)}`);
        }
        if (this.filename) {
            parts.push(`filename=${quote(this.filename)}`);
        }
        if (this.filenameSplat) {
            parts.push(`filename*=${quote(this.filenameSplat)}`);
        }
        return parts.join('; ');
    }
    /**
     * Parse a Content-Disposition header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A ContentDisposition instance (empty if null)
     */
    static from(value) {
        let header = new ContentDisposition();
        if (value !== null) {
            if (typeof value === 'string') {
                let params = parseParams(value);
                if (params.length > 0) {
                    header.type = params[0][0];
                    for (let [name, val] of params.slice(1)) {
                        if (name === 'filename') {
                            header.filename = val;
                        }
                        else if (name === 'filename*') {
                            header.filenameSplat = val;
                        }
                        else if (name === 'name') {
                            header.name = val;
                        }
                    }
                }
            }
            else {
                header.filename = value.filename;
                header.filenameSplat = value.filenameSplat;
                header.name = value.name;
                header.type = value.type;
            }
        }
        return header;
    }
}
function decodeFilenameSplat(value) {
    let match = value.match(/^([\w-]+)'([^']*)'(.+)$/);
    if (!match)
        return null;
    let [, charset, , encodedFilename] = match;
    let decodedFilename = percentDecode(encodedFilename);
    try {
        let decoder = new TextDecoder(charset);
        let bytes = new Uint8Array(decodedFilename.split('').map((char) => char.charCodeAt(0)));
        return decoder.decode(bytes);
    }
    catch (error) {
        console.warn(`Failed to decode filename from charset ${charset}:`, error);
        return decodedFilename;
    }
}
function percentDecode(value) {
    return value
        .replace(/\+/g, ' ')
        .replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
