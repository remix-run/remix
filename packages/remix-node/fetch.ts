import type { Readable } from "stream";
import { PassThrough } from "stream";
import type AbortController from "abort-controller";
// import FormStream from "form-data";
// import type { RequestInfo, RequestInit, Response } from "node-fetch";
// import nodeFetch, { Request as BaseNodeRequest } from "node-fetch";
import { Request as BaseNodeRequest } from "@web-std/fetch";

// import { FormData as NodeFormData, isFile } from "./formData";
import type { UploadHandler } from "./formData";
import { internalParseFormData } from "./parseMultipartFormData";

// export type { HeadersInit, RequestInfo, ResponseInit } from "node-fetch";
// export { Headers, Response } from "node-fetch";

export { fetch, Headers, Response } from "@web-std/fetch";

interface NodeRequestInit extends RequestInit {
  abortController?: AbortController;
}

class NodeRequest extends BaseNodeRequest {
  private abortController?: AbortController;

  constructor(input: RequestInfo, init?: NodeRequestInit | undefined) {
    super(input, init);

    let anyInput = input as any;
    let anyInit = init as any;

    this.abortController =
      anyInput?.abortController || anyInit?.abortController;
  }

  async formData(uploadHandler?: UploadHandler): Promise<FormData> {
    let contentType = this.headers.get("Content-Type");
    if (
      contentType &&
      (/application\/x-www-form-urlencoded/.test(contentType) ||
        /multipart\/form-data/.test(contentType))
    ) {
      return await internalParseFormData(
        this,
        super.formData,
        this.abortController,
        uploadHandler
      );
    }

    throw new Error("Invalid MIME type");
  }

  clone(): NodeRequest {
    return new NodeRequest(this);
  }
}

export { NodeRequest as Request, NodeRequestInit as RequestInit };

// /**
//  * A `fetch` function for node that matches the web Fetch API. Based on
//  * `node-fetch`.
//  *
//  * @see https://github.com/node-fetch/node-fetch
//  * @see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
//  */
// export function fetch(
//   input: RequestInfo,
//   init?: RequestInit
// ): Promise<Response> {
//   init = { compress: false, ...init };

//   if (init?.body instanceof NodeFormData) {
//     init = {
//       ...init,
//       body: formDataToStream(init.body),
//     };
//   }

//   // Default to { compress: false } so responses can be proxied through more
//   // easily in loaders. Otherwise the response stream encoding will not match
//   // the Content-Encoding response header.
//   return nodeFetch(input, init);
// }
