import type { UploadHandler } from "@remix-run/server-runtime";

import { MeterError } from "./meter";

export type MemoryUploadHandlerFilterArgs = {
  filename?: string;
  contentType: string;
  name: string;
};

export type MemoryUploadHandlerOptions = {
  /**
   * The maximum upload size allowed. If the size is exceeded an error will be thrown.
   * Defaults to 3000000B (3MB).
   */
  maxFileSize?: number;
  /**
   *
   * @param filename
   * @param mimetype
   * @param encoding
   */
  filter?(args: MemoryUploadHandlerFilterArgs): boolean | Promise<boolean>;
};

export function createMemoryUploadHandler({
  filter,
  maxFileSize = 3000000,
}: MemoryUploadHandlerOptions = {}): UploadHandler {
  return async ({ filename, contentType, name, data }) => {
    if (filter && !(await filter({ filename, contentType, name }))) {
      return undefined;
    }

    let size = 0;
    let chunks = [];
    for await (let chunk of data) {
      size += chunk.byteLength;
      if (size > maxFileSize) {
        throw new MeterError(name, maxFileSize);
      }
      chunks.push(chunk);
    }

    if (typeof filename === "string") {
      return new File(chunks, filename, { type: contentType });
    }

    return await new Blob(chunks, { type: contentType }).text();
  };
}
