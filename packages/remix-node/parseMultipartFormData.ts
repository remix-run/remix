import { PassThrough } from "stream";
import Busboy from "busboy";
import { FormData } from "@remix-run/web-fetch";

import type { Request as NodeRequest } from "./fetch";
import type { UploadHandler } from "./formData";

/**
 * Allows you to handle multipart forms (file uploads) for your app.
 *
 * @see https://remix.run/api/remix#parsemultipartformdata-node
 */
export function parseMultipartFormData(
  request: Request,
  uploadHandler: UploadHandler
) {
  return (request as unknown as NodeRequest).formData(uploadHandler);
}

export async function internalParseFormData(
  request: Request,
  internalFormData: any,
  abortController?: AbortController,
  uploadHandler?: UploadHandler
) {
  let formData = new FormData();
  let contentType = request.headers.get("Content-Type") || "";
  if (/application\/x-www-form-urlencoded/.test(contentType)) {
    let searchParams = new URLSearchParams(await request.text());
    for (let [key, value] of searchParams.entries()) {
      formData.append(key, value);
    }
    return formData;
  }

  if (!uploadHandler) {
    return internalFormData();
  }

  let fileWorkQueue: Promise<void>[] = [];

  let stream: PassThrough = new PassThrough();
  if (request.body) {
    let reader = request.body.getReader();
    async function read() {
      let { done, value } = await reader.read();
      if (done) {
        stream.end(value);
        return;
      }
      stream.write(value);
      read();
    }
    read();
  } else {
    stream.end();
  }

  await new Promise<void>(async (resolve, reject) => {
    try {
      let busboy = new Busboy({
        highWaterMark: 2 * 1024 * 1024,
        headers: {
          "content-type": contentType,
        },
      });

      let aborted = false;
      function abort(error?: Error) {
        if (aborted) return;
        aborted = true;

        stream.unpipe();
        stream.removeAllListeners();
        busboy.removeAllListeners();

        abortController?.abort();
        reject(error || new Error("failed to parse form data"));
      }

      busboy.on("field", (name, value) => {
        formData.append(name, value);
      });

      busboy.on("file", (name, filestream, filename, encoding, mimetype) => {
        if (uploadHandler) {
          fileWorkQueue.push(
            (async () => {
              try {
                let value = await uploadHandler({
                  name,
                  stream: filestream,
                  filename,
                  encoding,
                  mimetype,
                });

                if (typeof value !== "undefined") {
                  formData.append(name, value);
                }
              } catch (error: any) {
                // Emit error to busboy to bail early if possible
                busboy.emit("error", error);
                // It's possible that the handler is doing stuff and fails
                // *after* busboy has finished. Rethrow the error for surfacing
                // in the Promise.all(fileWorkQueue) below.
                throw error;
              } finally {
                filestream.resume();
              }
            })()
          );
        } else {
          filestream.resume();
        }

        if (!uploadHandler) {
          console.warn(
            `Tried to parse multipart file upload for field "${name}" but no uploadHandler was provided.` +
              " Read more here: https://remix.run/api/remix#parseMultipartFormData-node"
          );
        }
      });

      stream.on("error", abort);
      stream.on("aborted", abort);
      busboy.on("error", abort);
      busboy.on("finish", resolve);

      stream.pipe(busboy);
    } catch (err) {
      reject(err);
    }
  });

  await Promise.all(fileWorkQueue);

  return formData;
}
