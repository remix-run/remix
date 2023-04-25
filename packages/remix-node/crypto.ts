import cookieSignature from "cookie-signature";
import type {
  SignFunction,
  UnsignFunction,
  DecryptFunction,
  EncryptFunction,
} from "@remix-run/server-runtime";
import crypto from "crypto";

export const sign: SignFunction = async (value, secret) => {
  return cookieSignature.sign(value, secret);
};

export const unsign: UnsignFunction = async (
  signed: string,
  secret: string
) => {
  return cookieSignature.unsign(signed, secret);
};

const ALGORITHM_NAME = "aes-256-gcm";
const ALGORITHM_NONCE_SIZE = 16;
const ALGORITHM_TAG_SIZE = 16;
const ALGORITHM_KEY_SIZE = 32;

export function key(encryption_key: string) {
  return Buffer.from(
    crypto.hkdfSync(
      "sha512-256",
      encryption_key,
      `remix-run`,
      `build better web`,
      ALGORITHM_KEY_SIZE
    )
  );
}

export const encrypt: EncryptFunction = async (
  payload: string,
  encryption_key: string
) => {
  let iv = crypto.randomBytes(ALGORITHM_NONCE_SIZE);
  let cipher = crypto.createCipheriv(ALGORITHM_NAME, key(encryption_key), iv);

  let encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);

  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString(
    "base64url"
  );
};

export const decrypt: DecryptFunction = async (
  payload: string,
  encryption_key: string
) => {
  try {
    let buff = Buffer.from(payload, "base64url");
    let iv = buff.subarray(0, ALGORITHM_NONCE_SIZE);
    let ciphertext = buff.subarray(
      ALGORITHM_NONCE_SIZE,
      buff.length - ALGORITHM_TAG_SIZE
    );
    let tag = buff.subarray(ciphertext.length + ALGORITHM_NONCE_SIZE);

    // Create the cipher instance.
    let cipher = crypto.createDecipheriv(
      ALGORITHM_NAME,
      key(encryption_key),
      iv
    );

    // Decrypt and return result.
    cipher.setAuthTag(tag);

    return Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString(
      "utf-8"
    );
  } catch (e) {
    return false;
  }
};
