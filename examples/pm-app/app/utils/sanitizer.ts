/**
 * @author Adam Jaso <ajaso@pocketly.com>
 * https://github.com/pocketly/node-sanitize
 */

import validator from "validator";
import { isFunction, isObject, isPlainObject } from "~/utils";

export class Sanitizer {
  static bool(value: any): boolean {
    return typeof value === "boolean" ? value : validator.toBoolean(value);
  }

  static float(value: any): number | null {
    let arg;
    let flo;
    if (Array.isArray(value)) {
      arg = parseInt(value[1]);
      value = value[0];
    }
    try {
      flo = parseFloat(value);
      if (typeof arg === "number") {
        flo = parseFloat(flo.toFixed(arg));
      }
    } catch (e) {
      return null;
    }
    return flo;
  }

  static int(value: any) {
    try {
      return parseInt(value);
    } catch (e) {
      return null;
    }
  }

  static array(arr: any): unknown[] | null {
    return Array.isArray(arr) ? (arr as unknown[]) : null;
  }

  static plainObject(obj: any): Record<string | number, unknown> {
    return isPlainObject(obj) ? obj : null;
  }

  static obj(obj: any): object | null {
    return isObject(obj) ? obj : null;
  }

  static phone(value: any): string | null {
    return value != null &&
      (typeof value === "string" || typeof value === "number")
      ? String(value).replace(/[^0-9]+/gi, "")
      : null;
  }

  static email(value: any): string | null {
    return validator.isEmail(value) ? value : null;
  }

  static url(value: any): string | null {
    let protocol;
    let options;
    if (Array.isArray(value)) {
      protocol = value[1];
      options = { protocols: [protocol] };
      value = value[0];
    }
    return validator.isURL(value, options) ? fixUrl(value, protocol) : null;
  }

  static regex(value: any, regex: any) {
    try {
      if (regex && regex instanceof RegExp) {
        value = value.toString();
        return regex.test(value) ? value : null;
      } else {
        return null;
      }
    } catch (_) {
      return null;
    }
  }

  static func<F extends (...args: any[]) => any = (...args: any[]) => unknown>(
    value: any,
    func: any
  ): ReturnType<F> | null {
    if (func && isFunction(func)) {
      return func(value);
    }
    return null;
  }

  static str(value: any): string | null {
    return value != null ? value.toString() : null;
  }

  // TODO: Implement
  static cleanHtmlString(value: any): string | null {
    return value != null ? value.toString() : null;
  }

  static json(value: any): Json | null {
    try {
      if (typeof value === "string") {
        return JSON.parse(value);
      }

      if (isPlainObject(value) || isObject(value)) {
        return JSON.parse(JSON.stringify(value));
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}

function fixUrl(url: string, protocol: string) {
  if (!url) {
    return url;
  }

  protocol = protocol || "http";

  // does it start with desired protocol?
  if (new RegExp("^" + protocol + "://", "i").test(url)) {
    return url;
  }

  // if we have a different protocol, then invalidate
  if (/^\w+:\/\//i.test(url)) {
    return null;
  }

  // apply protocol to "abc.com/abc"
  if (/^(?:\w+)(?:\.\w{2,})+(?:\/.*)?/.test(url)) {
    return protocol + "://" + url;
  }

  return null;
}

interface Json {
  [x: string]: string | number | boolean | Date | Json | JsonArray;
}

interface JsonArray
  extends Array<string | number | boolean | Date | Json | JsonArray> {}
