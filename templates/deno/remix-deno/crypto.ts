import type { SignFunction, UnsignFunction } from "./deps/@remix-run/server-runtime.ts"

const encoder = new TextEncoder();

export const sign: SignFunction = async (value, secret) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const data = encoder.encode(value);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const hash = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(
    /=+$/,
    ""
  );

  return value + "." + hash;
}

export const unsign: UnsignFunction = async (cookie, secret) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const value = cookie.slice(0, cookie.lastIndexOf("."));
  const hash = cookie.slice(cookie.lastIndexOf(".") + 1);

  const data = encoder.encode(value);
  const signature = byteStringToUint8Array(atob(hash));
  const valid = await crypto.subtle.verify("HMAC", key, signature, data);

  return valid ? value : false;
}

function byteStringToUint8Array(byteString: string): Uint8Array {
  const array = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; i++) {
    array[i] = byteString.charCodeAt(i);
  }

  return array;
}
