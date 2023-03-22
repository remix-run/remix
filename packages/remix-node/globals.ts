import { atob, btoa } from "./base64";
import { Blob, File } from "./fetch";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
    }

    interface Global {
      atob: typeof atob;
      btoa: typeof btoa;

      // TODO: introduce versions of these
      Blob: typeof Blob;
      File: typeof File;
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
  if (!global.Blob) {
    global.Blob = Blob;
  }
  if (!global.File) {
    global.File = File;
  }
}
