import {
  Headers as NodeHeaders, readableStreamToString,
  Request as NodeRequest
} from "@remix-run/node";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyResult
} from "aws-lambda";
import type {
  Response as NodeResponse,
} from "@remix-run/node";
import { URLSearchParams } from "url";

import { isBinaryType } from "../binaryTypes";

export function createRemixRequest(event: APIGatewayProxyEvent): NodeRequest {
  let host = event.headers["x-forwarded-host"] || event.headers.Host;
  let scheme = process.env.ARC_SANDBOX ? "http" : "https";

  let rawQueryString = new URLSearchParams(event.queryStringParameters as Record<string, string>).toString();
  let search = rawQueryString.length > 0 ? `?${rawQueryString}` : "";
  let url = new URL(event.path + search, `${scheme}://${host}`);

  let isFormData = event.headers["content-type"]?.includes(
    "multipart/form-data"
  );

  return new NodeRequest(url.href, {
    method: event.requestContext.httpMethod,
    headers: createRemixHeaders(event.headers),
    body:
      event.body && event.isBase64Encoded
        ? isFormData
          ? Buffer.from(event.body, "base64")
          : Buffer.from(event.body, "base64").toString()
        : event.body || undefined,
  });
}

export function createRemixHeaders(
  requestHeaders: APIGatewayProxyEventHeaders
): NodeHeaders {
  let headers = new NodeHeaders();

  for (let [header, value] of Object.entries(requestHeaders)) {
    if (value) {
      headers.append(header, value);
    }
  }

  return headers;
}

export async function sendRemixResponse(
  nodeResponse: NodeResponse
): Promise<APIGatewayProxyResult> {
  let contentType = nodeResponse.headers.get("Content-Type");
  let isBase64Encoded = isBinaryType(contentType);
  let body: string | undefined;

  if (nodeResponse.body) {
    if (isBase64Encoded) {
      body = await readableStreamToString(nodeResponse.body, "base64");
    } else {
      body = await nodeResponse.text();
    }
  }

  return {
    statusCode: nodeResponse.status,
    headers: Object.fromEntries(nodeResponse.headers.entries()),
    body: body || '',
    isBase64Encoded,
  };
}