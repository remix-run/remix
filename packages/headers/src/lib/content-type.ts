import { HeaderValue } from './header-value.js';
import { parseParams, quote } from './param-values.js';

export interface ContentTypeInit {
  /**
   * For multipart entities, the boundary that separates the different parts of the message.
   */
  boundary?: string;
  /**
   * Indicates the [character encoding](https://developer.mozilla.org/en-US/docs/Glossary/Character_encoding) of the content.
   *
   * For example, `utf-8`, `iso-8859-1`.
   */
  charset?: string;
  /**
   * The media type (or MIME type) of the content. This consists of a type and subtype, separated by a slash.
   *
   * For example, `text/html`, `application/json`, `image/png`.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types)
   */
  mediaType?: string;
}

/**
 * The value of a `Content-Type` HTTP header.
 *
 * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type)
 */
export class ContentType implements HeaderValue, ContentTypeInit {
  boundary?: string;
  charset?: string;
  mediaType?: string;

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
