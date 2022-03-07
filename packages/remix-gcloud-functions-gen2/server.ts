import { 
    Request as GcfRequest, 
    Response as GcfResponse 
} from "@google-cloud/functions-framework";
import {
    // This has been added as a global in node 15+
    AbortController,
    Headers as NodeHeaders,
    Request as NodeRequest,
} from "@remix-run/node";
import { serverRuntime } from '@remix-run/server-runtime';

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */

/**
 * Returns a request handler for Express that serves the response using Remix.
 */
export function createRequestHandler({
    build,
    getLoadContext,
    mode = process.env.NODE_ENV
}) {
    const platform = {};
    const handleRequest = serverRuntime.createRequestHandler(build, platform, mode);
    return async (req: GcfRequest, res: GcfResponse) => {
        let abortController = new AbortController();
        let request = createRemixRequest(req, abortController);
        let loadContext = typeof getLoadContext === "function" ? getLoadContext(req, res) : undefined;
        let response = await handleRequest(request, loadContext);
        sendRemixResponse(res, response, abortController);
    };
}

export function createRemixHeaders(requestHeaders) {
    let headers = new Headers();

    for (let [key, values] of Object.entries(requestHeaders)) {
        if (values) {
            if (Array.isArray(values)) {
                for (const value of values) {
                    headers.append(key, value);
                }
            } else {
                headers.set(key, values);
            }
        }
    }

    return headers;
}

export function createRemixRequest(req: GcfRequest, abortController) {
    let origin = `${req.protocol}://${req.get("host")}`;
    let url = new URL(req.url, origin);
    let init = {
        method: req.method,
        headers: createRemixHeaders(req.headers),
        signal: abortController === null || abortController === void 0 ? void 0 : abortController.signal,
        abortController
    };

    if (hasBody(req)) {
        init.body = createRemixBody(req);
    }

    return new Request(url.href, init);
}

function sendRemixResponse(res, response, abortController) {
    var _response$body;

    res.statusMessage = response.statusText;
    res.status(response.status);

    for (let [key, values] of Object.entries(response.headers.raw())) {
        for (const value of values) {
            res.append(key, value);
        }
    }

    if (abortController.signal.aborted) {
        res.set("Connection", "close");
    }

    if (Buffer.isBuffer(response.body)) {
        res.end(response.body);
    } else if ((_response$body = response.body) !== null && _response$body !== void 0 && _response$body.pipe) {
        response.body.pipe(res);
    } else {
        res.end();
    }
}
/**
 * Google Cloud Functions includes middleware that processes incoming requests based on their headers and sets the request body to
 * a javascript object. But Remix doesn't like that, remix has its own request processing logic, so we have to turn the body back into
 * something that Remix is expecting. In this case a Buffer with URLSearchParams encoded data works.
 * 
 * @param req the request passed in from the Google Cloud Function
 */
function createRemixBody(req: GcfRequest): Buffer {
    return Buffer.from(new URLSearchParams(req.body).toString());
}

function hasBody(req: GcfRequest): boolean {
    const body = req.body;
    if (!body) {
        return false;
    }
    for (var x in body) { return true; }
    return false;
}
