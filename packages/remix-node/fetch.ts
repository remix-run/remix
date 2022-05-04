import type { Readable } from "stream";

import type AbortController from "abort-controller";
import { Request as BaseNodeRequest } from "@remix-run/web-fetch";

import type { UploadHandler } from "./formData";
import { internalParseFormData } from "./parseMultipartFormData";

import type { Headers as NodeHeaders } from "@remix-run/web-fetch";
import { fetch as nodeFetch } from "@remix-run/web-fetch";

export { File, Blob } from "@remix-run/web-file";
export { Headers, Response } from "@remix-run/web-fetch";

type NodeHeadersInit = ConstructorParameters<typeof NodeHeaders>[0];
type NodeRequestInfo = ConstructorParameters<typeof BaseNodeRequest>[0];
type BaseNodeRequestInit = NonNullable<
  ConstructorParameters<typeof BaseNodeRequest>[1]
>;

type NodeResponseInit = Omit<
  NonNullable<ConstructorParameters<typeof BaseNodeRequest>[1]>,
  "body"
> & {
  body?:
    | NonNullable<ConstructorParameters<typeof BaseNodeRequest>[1]>["body"]
    | Readable;
};
interface NodeRequestInit extends Omit<BaseNodeRequestInit, "body"> {
  abortController?: AbortController;
  body?: BaseNodeRequestInit["body"] | Readable;
}

class NodeRequest extends BaseNodeRequest {
  private abortController?: AbortController;

  constructor(input: NodeRequestInfo, init?: NodeRequestInit | undefined) {
    super(input as any, init as BaseNodeRequestInit);

    let anyInput = input as any;
    let anyInit = init as any;

    this.abortController =
      anyInput?.abortController || anyInit?.abortController;
  }

  formData(uploadHandler?: UploadHandler): Promise<FormData> {
    let contentType = this.headers.get("Content-Type");
    if (
      uploadHandler &&
      contentType &&
      /multipart\/form-data/.test(contentType)
    ) {
      return internalParseFormData(this, uploadHandler, this.abortController);
    }

    return super.formData();
  }

  clone(): NodeRequest {
    return new NodeRequest(this);
  }
}

export const fetch: typeof nodeFetch = (
  input: NodeRequestInfo,
  init?: NodeRequestInit
) => {
  init = {
    compress: false,
    ...init,
  };

  return nodeFetch(input, init as BaseNodeRequestInit);
};

export type {
  NodeHeadersInit as HeadersInit,
  NodeRequestInfo as RequestInfo,
  NodeRequestInit as RequestInit,
  NodeResponseInit as ResponseInit,
};
export { NodeRequest as Request };
