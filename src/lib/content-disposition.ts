import { HeaderValue } from './header-value.js';
import { parseParams, quote } from './param-values.js';

/**
 * Represents the value of a `Content-Disposition` HTTP header.
 */
export class ContentDisposition implements HeaderValue {
  public type?: string;
  public filename?: string;
  public filenameSplat?: string;
  public name?: string;

  constructor(initialValue?: string) {
    if (initialValue) {
      let params = parseParams(initialValue);
      if (params.length > 0) {
        this.type = params[0][0];
        for (let [name, value] of params.slice(1)) {
          if (name === 'filename') {
            this.filename = value;
          } else if (name === 'filename*') {
            this.filenameSplat = value;
          } else if (name === 'name') {
            this.name = value;
          }
        }
      }
    }
  }

  get preferredFilename(): string | undefined {
    // From RFC 6266:
    // Many user agent implementations predating this specification do not understand the "filename*" parameter.
    // Therefore, when both "filename" and "filename*" are present in a single header field value, recipients SHOULD
    // pick "filename*" and ignore "filename". This way, senders can avoid special-casing specific user agents by
    // sending both the more expressive "filename*" parameter, and the "filename" parameter as fallback for legacy recipients.
    let filenameSplat = this.filenameSplat;
    if (filenameSplat) {
      let decodedFilename = decodeFilenameSplat(filenameSplat);
      if (decodedFilename) return decodedFilename;
    }

    return this.filename;
  }

  toString(): string {
    let parts = [];

    if (this.type) {
      parts.push(this.type);
    }
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
}

function decodeFilenameSplat(value: string): string | null {
  let match = value.match(/^([\w-]+)'([^']*)'(.+)$/);
  if (!match) return null;

  let [, charset, , encodedFilename] = match;

  let decodedFilename = percentDecode(encodedFilename);

  try {
    let decoder = new TextDecoder(charset);
    let bytes = new Uint8Array(decodedFilename.split('').map((char) => char.charCodeAt(0)));
    return decoder.decode(bytes);
  } catch (error) {
    console.warn(`Failed to decode filename from charset ${charset}:`, error);
    return decodedFilename;
  }
}

function percentDecode(value: string): string {
  return value.replace(/\+/g, ' ').replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
}
