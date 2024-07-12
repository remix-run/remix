import { HeaderValue } from './header-value.js';
import { quote, unquote } from './param-values.js';

/**
 * Represents the value of a `Content-Disposition` HTTP header.
 */
export class ContentDisposition implements HeaderValue {
  private attributes: Map<string, string>;
  private _type: string;

  constructor(initialValue: string) {
    this.attributes = new Map();
    let parts = initialValue.split(';').map((part) => part.trim());
    this._type = parts[0];
    for (let i = 1; i < parts.length; i++) {
      let match = parts[i].match(/([\w\*]+)\s*=\s*(.*)/);
      if (match) {
        this.attributes.set(match[1].toLowerCase(), unquote(match[2]));
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

  get filename(): string | undefined {
    return this.attributes.get('filename');
  }

  set filename(value: string | null) {
    if (value === null) {
      this.attributes.delete('filename');
    } else {
      this.attributes.set('filename', value);
    }
  }

  get filenameSplat(): string | undefined {
    return this.attributes.get('filename*');
  }

  set filenameSplat(value: string | null) {
    if (value === null) {
      this.attributes.delete('filename*');
    } else {
      this.attributes.set('filename*', value);
    }
  }

  get name(): string | undefined {
    return this.attributes.get('name');
  }

  set name(value: string | null) {
    if (value === null) {
      this.attributes.delete('name');
    } else {
      this.attributes.set('name', value);
    }
  }

  get type(): string {
    return this._type;
  }

  set type(value: string) {
    this._type = value.trim();
  }

  toString(): string {
    let parts = [this._type];
    for (let [key, value] of this.attributes) {
      parts.push(`${key}=${quote(value)}`);
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
