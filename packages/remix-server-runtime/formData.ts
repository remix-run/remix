import { streamMultipart } from "@web3-storage/multipart-parser";

export type UploadHandlerPart = {
  name: string;
  filename: string;
  contentType: string;
  data: AsyncIterable<Uint8Array>;
};

export type UploadHandler = (
  part: UploadHandlerPart
) => Promise<string | File | undefined>;

/**
 * Allows you to handle multipart forms (file uploads) for your app.
 *
 * TODO: Update this comment
 * @see https://remix.run/api/remix#parsemultipartformdata-node
 */
export async function parseMultipartFormData(
  request: Request,
  uploadHandler: UploadHandler
): Promise<FormData> {
  let contentType = request.headers.get("Content-Type") || "";
  let [type, boundary] = contentType.split(/\s*;\s*boundary=/);

  if (!request.body || !boundary || type !== "multipart/form-data") {
    throw new TypeError("Could not parse content as FormData.");
  }

  let formData = new FormData();
  let parts: AsyncIterable<UploadHandlerPart & { done?: true }> =
    streamMultipart(request.body, boundary);

  for await (let part of parts) {
    if (part.done) break;

    if (!part.contentType || part.contentType.startsWith("text/")) {
      formData.append(part.name, await bufferPart(part));
    } else {
      let file = await uploadHandler(part);
      if (typeof file !== "undefined") {
        formData.append(part.name, file);
      }
    }
  }

  return formData;
}

async function bufferPart(part: UploadHandlerPart): Promise<string> {
  let chunks = [];

  for await (let chunk of part.data) {
    chunks.push(chunk);
  }

  return new TextDecoder().decode(mergeArrays(...chunks));
}

function mergeArrays(...arrays: Uint8Array[]) {
  let out = new Uint8Array(
    arrays.reduce((total, arr) => total + arr.length, 0)
  );
  let offset = 0;
  for (let arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}
