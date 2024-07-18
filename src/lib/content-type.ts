import { HeaderValue } from './header-value.js';
import { parseParams, quote } from './param-values.js';

export interface ContentTypeInit {
  boundary?: string;
  charset?: string;
  mediaType?: string;
}

/**
 * Represents the value of a `Content-Type` HTTP header.
 */
export class ContentType implements HeaderValue {
  public boundary?: string;
  public charset?: string;
  public mediaType?: string;

  constructor(init?: string | ContentTypeInit) {
    if (init) {
      if (typeof init === 'string') {
        let params = parseParams(init);
        if (params.length > 0) {
          this.mediaType = params[0][0];
          for (let [name, value] of params.slice(1)) {
            if (name === 'boundary') {
              this.boundary = value;
            } else if (name === 'charset') {
              this.charset = value;
            }
          }
        }
      } else {
        this.boundary = init.boundary;
        this.charset = init.charset;
        this.mediaType = init.mediaType;
      }
    }
  }

  toString(): string {
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
}
