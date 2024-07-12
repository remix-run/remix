import { HeaderValue } from "./header-value.js";
import { quote, unquote } from "./param-values.js";

/**
 * Represents the value of a `Content-Type` HTTP header.
 */
export class ContentType implements HeaderValue {
  private attributes: Map<string, string>;
  private _mediaType: string;

  constructor(initialValue: string) {
    this.attributes = new Map();
    let parts = initialValue.split(";").map(part => part.trim());
    this._mediaType = parts[0];
    for (let i = 1; i < parts.length; i++) {
      let match = parts[i].match(/(\w+)\s*=\s*(.*)/);
      if (match) {
        this.attributes.set(match[1].toLowerCase(), unquote(match[2]));
      }
    }
  }

  get boundary(): string | undefined {
    return this.attributes.get("boundary");
  }

  set boundary(value: string | null) {
    if (value === null) {
      this.attributes.delete("boundary");
    } else {
      this.attributes.set("boundary", value);
    }
  }

  get charset(): string | undefined {
    return this.attributes.get("charset");
  }

  set charset(value: string | null) {
    if (value === null) {
      this.attributes.delete("charset");
    } else {
      this.attributes.set("charset", value);
    }
  }

  get mediaType(): string {
    return this._mediaType;
  }

  set mediaType(value: string) {
    this._mediaType = value.trim();
  }

  toString(): string {
    let parts = [this._mediaType];
    for (let [key, value] of this.attributes) {
      parts.push(`${key}=${quote(value)}`);
    }
    return parts.join("; ");
  }
}
