declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
    }

    interface Global {
      File: typeof File;

      Headers: typeof Headers;
      Request: typeof Request;
      Response: typeof Response;
      fetch: typeof fetch;
      FormData: typeof FormData;

      ReadableStream: typeof ReadableStream;
      WritableStream: typeof WritableStream;
    }
  }

  interface RequestInit {
    duplex?: "half";
  }
}

export function installGlobals({
  nativeFetch,
}: { nativeFetch?: boolean } = {}) {
  if (nativeFetch) {
    let {
      File: UndiciFile,
      fetch: undiciFetch,
      FormData: UndiciFormData,
      Headers: UndiciHeaders,
      Request: UndiciRequest,
      Response: UndiciResponse,
    } = require("undici");
    global.File = UndiciFile as unknown as typeof File;
    global.Headers = UndiciHeaders;
    global.Request = UndiciRequest;
    global.Response = UndiciResponse;
    global.fetch = undiciFetch;
    global.FormData = UndiciFormData;
  } else {
    let {
      File: RemixFile,
      fetch: RemixFetch,
      FormData: RemixFormData,
      Headers: RemixHeaders,
      Request: RemixRequest,
      Response: RemixResponse,
    } = require("@remix-run/web-fetch");
    global.File = RemixFile;
    global.Headers = RemixHeaders;
    global.Request = RemixRequest;
    global.Response = RemixResponse;
    global.fetch = RemixFetch;
    global.FormData = RemixFormData;
  }
}
