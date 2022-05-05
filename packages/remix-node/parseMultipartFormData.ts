import { FormData } from "@remix-run/web-fetch";
import { streamMultipart } from "@web3-storage/multipart-parser";

import type { Request as NodeRequest } from "./fetch";
import type { UploadHandler } from "./formData";

/**
 * Allows you to handle multipart forms (file uploads) for your app.
 *
 * @see https://remix.run/api/remix#parsemultipartformdata-node
 */
export function parseMultipartFormData(
  request: Request | NodeRequest,
  uploadHandler: UploadHandler
) {
  return internalParseFormData(request, uploadHandler);
}

export const internalParseFormData = async (
  request: Request,
  uploadHandler: UploadHandler
) => {
  let contentType = request.headers.get("Content-Type") || "";
  let [type, boundary] = contentType.split(/\s*;\s*boundary=/);

  if (!request.body || !boundary || type !== "multipart/form-data") {
    throw new TypeError("Could not parse content as FormData.");
  }

  let formData = new FormData();

  let parts = streamMultipart(request.clone().body, boundary);

  for await (let part of parts) {
    if (part.done) break;

    if (!part.filename) {
      let chunks = [];
      for await (let chunk of part.data) {
        chunks.push(chunk);
      }

      formData.append(
        part.name,
        new TextDecoder().decode(mergeArrays(...chunks))
      );
    } else {
      let file = await uploadHandler(part);
      if (typeof file !== "undefined") {
        formData.append(part.name, file);
      }
    }
  }

  return formData;
};

export function mergeArrays(...arrays: Uint8Array[]) {
  const out = new Uint8Array(
    arrays.reduce((total, arr) => total + arr.length, 0)
  );
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}
