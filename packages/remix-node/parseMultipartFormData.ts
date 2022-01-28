import type { Readable } from "stream";

import Busboy from "busboy";

import type { Request as NodeRequest } from "./fetch";

export type UploadHandlerArgs = {
  name: string;
  stream: Readable;
  filename: string;
  encoding: string;
  mimetype: string;
};

export type UploadHandler = (
  args: UploadHandlerArgs
) => Promise<string | File | undefined>;

export function parseMultipartFormData(
  request: Request,
  uploadHandler: UploadHandler
) {
  return internalParseFormData(
    request as unknown as NodeRequest,
    uploadHandler
  );
}

export async function internalParseFormData(
  request: NodeRequest,
  uploadHandler?: UploadHandler
) {
  const contentType = request.headers.get("Content-Type") || "";
  // If mimeType’s essence is not "multipart/form-data" fallback to native
  // fetch behavior:
  if (!/multipart\/form-data/.test(contentType)) {
    return request.formData();
  }

  const formData = new FormData();

  // 1. Setup a parser for the body’s stream.
  const parser = Busboy({ headers: { "content-type": contentType } });
  let resolve: () => void, reject: (err: any) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const toWaitOn: Promise<void>[] = [];
  parser.once("close", () => {
    resolve();
  });
  parser.once("error", error => {
    console.log("SIGNAL PARSERs", request.signal);
    request.signal?.dispatchEvent(new Event("abort", { error } as any));
    reject(error);
  });
  parser.on("field", (key, value) => {
    formData.append(key, value);
  });
  parser.on("file", (name, stream, filename, encoding, mimetype) => {
    if (!uploadHandler) {
      stream.resume();
      return;
    }

    toWaitOn.push(
      (async () => {
        try {
          let value = await uploadHandler({
            name,
            stream,
            filename,
            encoding,
            mimetype
          });

          console.log({ value });
          if (typeof value !== "undefined") {
            formData.append(name, value);
          }
        } catch (error) {
          console.log("SIGNAL", request.signal);
          request.signal?.dispatchEvent(new Event("abort", { error } as any));
          throw error;
        } finally {
          stream.resume();
        }
      })()
    );
  });

  if (request.body) {
    for await (const chunk of request.body) {
      parser.write(chunk);
    }
  }
  parser.end();

  await promise;
  await Promise.all(toWaitOn);
  return formData;
}
