export { FormData } from "@remix-run/web-fetch";

export type UploadHandlerArgs = {
  name: string;
  filename: string;
  contentType: string;
  data: AsyncIterable<Uint8Array>;
};

export type UploadHandler = (
  args: UploadHandlerArgs
) => Promise<string | File | undefined>;
