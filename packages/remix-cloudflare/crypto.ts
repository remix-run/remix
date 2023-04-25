import type {
  SignFunction,
  UnsignFunction,
  DecryptFunction,
  EncryptFunction,
} from "@remix-run/server-runtime/crypto";

const encoder = new TextEncoder();

export const sign: SignFunction = async (value, secret) => {
  let key = await createKey(secret, ["sign"]);
  let data = encoder.encode(value);
  let signature = await crypto.subtle.sign("HMAC", key, data);
  let hash = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(
    /=+$/,
    ""
  );

  return value + "." + hash;
};

export const unsign: UnsignFunction = async (signed, secret) => {
  let index = signed.lastIndexOf(".");
  let value = signed.slice(0, index);
  let hash = signed.slice(index + 1);

  let key = await createKey(secret, ["verify"]);
  let data = encoder.encode(value);
  let signature = byteStringToUint8Array(atob(hash));
  let valid = await crypto.subtle.verify("HMAC", key, signature, data);

  return valid ? value : false;
};

export const encrypt: EncryptFunction = async (
  value: string,
  secret: string
) => {
  let aes_key = await createEncryptionKey(secret);
  let iv = crypto.getRandomValues(new Uint8Array(16));

  let encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    aes_key,
    encoder.encode(value)
  );

  return btoa(
    String.fromCharCode(...new Uint8Array(iv)) +
      String.fromCharCode(...new Uint8Array(encrypted))
  ).replace(/=+$/, "");
};

export const decrypt: DecryptFunction = async (
  encrypted: string,
  secret: string
) => {
  let cipher = byteStringToUint8Array(atob(encrypted));

  let aes_key = await createEncryptionKey(secret);
  let decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: cipher.slice(0, 16),
    },
    aes_key,
    cipher.slice(16)
  );

  return String.fromCharCode(...new Uint8Array(decrypted));
};

async function createEncryptionKey(encryption_key: string) {
  let master = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryption_key),
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      salt: encoder.encode(`remix-run`),
      info: encoder.encode("build better web"),
      hash: "SHA-512",
    },
    master,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function createKey(
  secret: string,
  usages: CryptoKey["usages"]
): Promise<CryptoKey> {
  let key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );

  return key;
}

function byteStringToUint8Array(byteString: string): Uint8Array {
  let array = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; i++) {
    array[i] = byteString.charCodeAt(i);
  }

  return array;
}
