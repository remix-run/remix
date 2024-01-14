/**
 * This file contains code very wrangler specific, often taken directly from wrangler, to try to help keeping them in sync
 * comments pointing to wrangler code being reused here have been added throughout this file
 */
import fetch from "node-fetch";

// https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev-registry.ts#L19
export type WorkerRegistry = Record<string, WorkerDefinition>;

// https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev-registry.ts#L21
export type WorkerDefinition = {
  port: number | undefined;
  protocol: "http" | "https" | undefined;
  host: string | undefined;
  mode: "local" | "remote";
  headers?: Record<string, string>;
  durableObjects: { name: string; className: string }[];
  durableObjectsHost?: string;
  durableObjectsPort?: number;
};

// https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev-registry.ts#L13
const DEV_REGISTRY_PORT = "6284";
// https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev-registry.ts#L14
const DEV_REGISTRY_HOST = `http://localhost:${DEV_REGISTRY_PORT}`;

// https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev/miniflare.ts#L43
export const EXTERNAL_DURABLE_OBJECTS_WORKER_NAME =
  "__WRANGLER_EXTERNAL_DURABLE_OBJECTS_WORKER";

// https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev/miniflare.ts#L43
export const EXTERNAL_DURABLE_OBJECTS_WORKER_SCRIPT = `
const HEADER_URL = "X-Miniflare-Durable-Object-URL";
const HEADER_NAME = "X-Miniflare-Durable-Object-Name";
const HEADER_ID = "X-Miniflare-Durable-Object-Id";
function createClass({ className, proxyUrl }) {
	return class {
		constructor(state) {
			this.id = state.id.toString();
		}
		fetch(request) {
			if (proxyUrl === undefined) {
				return new Response(\`[wrangler] Couldn't find \\\`wrangler dev\\\` session for class "\${className}" to proxy to\`, { status: 503 });
			}
			const proxyRequest = new Request(proxyUrl, request);
			proxyRequest.headers.set(HEADER_URL, request.url);
			proxyRequest.headers.set(HEADER_NAME, className);
			proxyRequest.headers.set(HEADER_ID, this.id);
			return fetch(proxyRequest);
		}
	}
}
export default {
	async fetch(request, env) {
		const originalUrl = request.headers.get(HEADER_URL);
		const className = request.headers.get(HEADER_NAME);
		const idString = request.headers.get(HEADER_ID);
		if (originalUrl === null || className === null || idString === null) {
			return new Response("[wrangler] Received Durable Object proxy request with missing headers", { status: 400 });
		}
		request = new Request(originalUrl, request);
		request.headers.delete(HEADER_URL);
		request.headers.delete(HEADER_NAME);
		request.headers.delete(HEADER_ID);
		const ns = env[className];
		const id = ns.idFromString(idString);
		const stub = ns.get(id);
		return stub.fetch(request);
	}
}
`;

// https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev-registry.ts#L170
export async function getRegisteredWorkers(): Promise<
  WorkerRegistry | undefined
> {
  try {
    let response = await fetch(`${DEV_REGISTRY_HOST}/workers`);
    return (await response.json()) as WorkerRegistry;
  } catch (e) {
    if (
      !["ECONNRESET", "ECONNREFUSED"].includes(
        (e as unknown as { cause?: { code?: string } }).cause?.code || "___"
      )
    ) {
      throw e;
    }
  }

  return;
}

// https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev/miniflare.ts#L137-L140
const IDENTIFIER_UNSAFE_REGEXP = /[^a-zA-Z0-9_$]/g;
export function getIdentifier(name: string) {
  return name.replace(IDENTIFIER_UNSAFE_REGEXP, "_");
}
