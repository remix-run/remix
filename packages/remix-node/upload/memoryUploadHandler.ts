import { File } from "../fetch";
import type { UploadHandler } from "../formData";
import { MeterError } from "./meter";

export type MemoryUploadHandlerFilterArgs = {
  filename: string;
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
}: MemoryUploadHandlerOptions): UploadHandler {
  return async ({ filename, contentType, name, data }) => {
    if (filter && !(await filter({ filename, contentType, name }))) {
      return undefined;
    }

    let size = 0;
    let chunks = [];
    for await (let chunk of data) {
      chunks.push(chunk);
      size += chunk.length;
      if (size > maxFileSize) {
        throw new MeterError(name, maxFileSize);
      }
    }

    return new File(chunks, filename, { type: contentType });
  };
}
