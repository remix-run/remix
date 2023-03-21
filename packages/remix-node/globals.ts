import { atob, btoa } from "./base64";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
    }

    interface Global {
      atob: typeof atob;
      btoa: typeof btoa;

      // TODO: introduce versions of these
      // Blob: typeof Blob;
      // File: typeof File;
    }
  }
}

export function installGlobals() {
  if (!global.atob) {
    global.atob = atob;
  }
  if (!global.btoa) {
    global.btoa = btoa;
  }
}
