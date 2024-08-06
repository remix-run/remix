import { HeaderValue } from './header-value.js';
import { parseParams, quote } from './param-values.js';
import { capitalize, isValidDate } from './utils.js';

type SameSiteValue = 'Strict' | 'Lax' | 'None';

export interface SetCookieInit {
  domain?: string;
  expires?: Date;
  httpOnly?: true;
  maxAge?: number;
  name?: string;
  path?: string;
  sameSite?: SameSiteValue;
  secure?: true;
  value?: string;
}

/**
 * The value of a `Set-Cookie` HTTP header.
 *
 * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
 */
export class SetCookie implements HeaderValue {
  domain?: string;
  expires?: Date;
  httpOnly?: true;
  maxAge?: number;
  name?: string;
  path?: string;
  sameSite?: SameSiteValue;
  secure?: true;
  value?: string;

  constructor(init?: string | SetCookieInit) {
    if (init) {
      if (typeof init === 'string') {
        let params = parseParams(init);
        if (params.length > 0) {
          this.name = params[0][0];
          this.value = params[0][1];

          for (let [key, value] of params.slice(1)) {
            switch (key.toLowerCase()) {
              case 'domain':
                this.domain = value;
                break;
              case 'expires': {
                if (typeof value === 'string') {
                  let v = new Date(value);
                  if (isValidDate(v)) this.expires = v;
                }
                break;
              }
              case 'httponly':
                this.httpOnly = true;
                break;
              case 'max-age': {
                if (typeof value === 'string') {
                  let v = parseInt(value, 10);
                  if (!isNaN(v)) this.maxAge = v;
                }
                break;
              }
              case 'path':
                this.path = value;
                break;
              case 'samesite':
                if (typeof value === 'string' && /strict|lax|none/i.test(value)) {
                  this.sameSite = capitalize(value) as SameSiteValue;
                }
                break;
              case 'secure':
                this.secure = true;
                break;
            }
          }
        }
      } else {
        this.domain = init.domain;
        this.expires = init.expires;
        this.httpOnly = init.httpOnly;
        this.maxAge = init.maxAge;
        this.name = init.name;
        this.path = init.path;
        this.sameSite = init.sameSite;
        this.secure = init.secure;
        this.value = init.value;
      }
    }
  }

  toString(): string {
    if (!this.name) {
      return '';
    }

    let parts = [`${this.name}=${quote(this.value || '')}`];

    if (this.domain) {
      parts.push(`Domain=${this.domain}`);
    }
    if (this.path) {
      parts.push(`Path=${this.path}`);
    }
    if (this.expires) {
      parts.push(`Expires=${this.expires.toUTCString()}`);
    }
    if (this.maxAge) {
      parts.push(`Max-Age=${this.maxAge}`);
    }
    if (this.secure) {
      parts.push('Secure');
    }
    if (this.httpOnly) {
      parts.push('HttpOnly');
    }
    if (this.sameSite) {
      parts.push(`SameSite=${this.sameSite}`);
    }

    return parts.join('; ');
  }
}
