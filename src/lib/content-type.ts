import { HeaderValue } from './header-value.js';
import { quote, parseParams } from './param-values.js';

/**
 * Represents the value of a `Content-Type` HTTP header.
 */
export class ContentType implements HeaderValue {
  public mediaType?: string;
  public boundary?: string;
  public charset?: string;

  constructor(initialValue?: string) {
    if (initialValue) {
      let params = parseParams(initialValue);
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
    }
  }

  toString(): string {
    let parts = [];

    if (this.mediaType) {
      parts.push(this.mediaType);
    }
    if (this.charset) {
      parts.push(`charset=${quote(this.charset)}`);
    }
    if (this.boundary) {
      parts.push(`boundary=${quote(this.boundary)}`);
    }

    return parts.join('; ');
  }
}
