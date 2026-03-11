import {} from "./header-value.js";
import { parseParams, quote } from "./param-values.js";
/**
 * The value of a `Content-Type` HTTP header.
 *
 * [MDN `Content-Type` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-3.1.1.5)
 */
export class ContentType {
    boundary;
    charset;
    mediaType;
    constructor(init) {
        if (init)
            return ContentType.from(init);
    }
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString() {
        if (!this.mediaType) {
            return '';
        }
        let parts = [this.mediaType];
        if (this.charset) {
            parts.push(`charset=${quote(this.charset)}`);
        }
        if (this.boundary) {
            parts.push(`boundary=${quote(this.boundary)}`);
        }
        return parts.join('; ');
    }
    /**
     * Parse a Content-Type header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A ContentType instance (empty if null)
     */
    static from(value) {
        let header = new ContentType();
        if (value !== null) {
            if (typeof value === 'string') {
                let params = parseParams(value);
                if (params.length > 0) {
                    header.mediaType = params[0][0];
                    for (let [name, val] of params.slice(1)) {
                        if (name === 'boundary') {
                            header.boundary = val;
                        }
                        else if (name === 'charset') {
                            header.charset = val;
                        }
                    }
                }
            }
            else {
                header.boundary = value.boundary;
                header.charset = value.charset;
                header.mediaType = value.mediaType;
            }
        }
        return header;
    }
}
