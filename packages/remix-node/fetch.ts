import type AbortController from "abort-controller";
import { Request as BaseNodeRequest } from "@remix-run/web-fetch";

import type { UploadHandler } from "./formData";
import { internalParseFormData } from "./parseMultipartFormData";

export { fetch, Headers, Response } from "@remix-run/web-fetch";

interface NodeRequestInit extends RequestInit {
  abortController?: AbortController;
}

class NodeRequest extends BaseNodeRequest {
  private abortController?: AbortController;

  constructor(input: RequestInfo, init?: NodeRequestInit | undefined) {
    super(input as any, init);

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
