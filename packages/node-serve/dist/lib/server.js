import { STATUS_CODES } from 'node:http';
import * as uWS from 'uWebSockets.js';
import { createUwsRequest } from "./uws-request.js";
// "Internal Server Error"
const internalServerErrorBody = [
    73, 110, 116, 101, 114, 110, 97, 108, 32, 83, 101, 114, 118, 101, 114, 32, 69, 114, 114, 111, 114,
];
/**
 * Creates a route handler for an existing uWebSockets.js app from a Fetch API handler.
 *
 * @param handler The fetch handler to use for processing incoming requests
 * @param options Request handler options
 * @returns A route handler that can be registered on a uWebSockets.js app
 */
export function createUwsRequestHandler(handler, options) {
    let onError = options?.onError ?? defaultErrorHandler;
    if (handler.length === 0) {
        let handlerWithoutArgs = handler;
        return (res, req) => {
            let state = createUwsResponseState(res);
            let method = req.getCaseSensitiveMethod();
            let response;
            try {
                response = handlerWithoutArgs();
            }
            catch (error) {
                void sendErrorResponse(res, state, method, onError, error);
                return;
            }
            if (isPromiseLike(response)) {
                void response.then((response) => {
                    void sendUwsResponse(res, state, method, response);
                }, (error) => {
                    void sendErrorResponse(res, state, method, onError, error);
                });
            }
            else {
                void sendUwsResponse(res, state, method, response);
            }
        };
    }
    if (handler.length === 1) {
        let requestHandler = handler;
        return (res, req) => {
            let state = createUwsResponseState(res);
            let method = req.getCaseSensitiveMethod();
            let request = createUwsRequest(req, res, state, options, method);
            let response;
            try {
                response = requestHandler(request);
            }
            catch (error) {
                void sendErrorResponse(res, state, method, onError, error);
                return;
            }
            if (isPromiseLike(response)) {
                void response.then((response) => {
                    void sendUwsResponse(res, state, method, response);
                }, (error) => {
                    void sendErrorResponse(res, state, method, onError, error);
                });
            }
            else {
                void sendUwsResponse(res, state, method, response);
            }
        };
    }
    return (res, req) => {
        let state = createUwsResponseState(res);
        let method = req.getCaseSensitiveMethod();
        let request = createUwsRequest(req, res, state, options, method);
        let client = createClientAddress(res);
        let response;
        try {
            response = handler(request, client);
        }
        catch (error) {
            void sendErrorResponse(res, state, method, onError, error);
            return;
        }
        if (isPromiseLike(response)) {
            void response.then((response) => {
                void sendUwsResponse(res, state, method, response);
            }, (error) => {
                void sendErrorResponse(res, state, method, onError, error);
            });
        }
        else {
            void sendUwsResponse(res, state, method, response);
        }
    };
}
/**
 * Starts a server that sends incoming requests to a Fetch API handler.
 *
 * @param handler The fetch handler to use for processing incoming requests
 * @param options Server options
 * @returns The running server
 */
export function serve(handler, options) {
    let app = createApp(options?.tls);
    let listenSocket = false;
    let port = 0;
    let ready = new Promise((resolve, reject) => {
        let onListen = (socket) => {
            if (socket === false) {
                reject(new Error(`Unable to listen on port ${options?.port ?? 3000}`));
                return;
            }
            listenSocket = socket;
            port = uWS.us_socket_local_port(socket);
            resolve();
        };
        app.any('/*', createUwsRequestHandler(handler, createServeRequestHandlerOptions(options)));
        if (options?.listenHost != null) {
            app.listen(options.listenHost, options.port ?? 3000, onListen);
        }
        else {
            app.listen(options?.port ?? 3000, onListen);
        }
    });
    return {
        app,
        ready,
        get port() {
            return port;
        },
        close() {
            if (listenSocket !== false) {
                uWS.us_listen_socket_close(listenSocket);
                listenSocket = false;
            }
            app.close();
        },
    };
}
function createApp(tls) {
    if (tls == null)
        return uWS.App();
    let options = {
        key_file_name: tls.keyFile,
        cert_file_name: tls.certFile,
    };
    if (tls.caFile != null)
        options.ca_file_name = tls.caFile;
    if (tls.passphrase != null)
        options.passphrase = tls.passphrase;
    return uWS.SSLApp(options);
}
function createServeRequestHandlerOptions(options) {
    if (options?.tls == null || options.protocol != null)
        return options;
    return { ...options, protocol: 'https:' };
}
async function sendUwsResponse(res, state, method, response) {
    if (state.aborted)
        return;
    if (method === 'HEAD' || response.body == null) {
        endUwsResponse(res, state, response, undefined);
        return;
    }
    let reader = response.body.getReader();
    try {
        let first = await reader.read();
        if (state.aborted)
            return;
        if (first.done) {
            endUwsResponse(res, state, response, undefined);
            return;
        }
        let second = await reader.read();
        if (state.aborted)
            return;
        if (second.done) {
            endUwsResponse(res, state, response, first.value);
            return;
        }
        writeResponseStart(res, state, response);
        if (!writeChunk(res, state, first.value)) {
            await waitForWritable(res);
            if (state.aborted)
                return;
        }
        if (!writeChunk(res, state, second.value)) {
            await waitForWritable(res);
            if (state.aborted)
                return;
        }
        while (true) {
            let result = await reader.read();
            if (state.aborted)
                return;
            if (result.done)
                break;
            if (!writeChunk(res, state, result.value)) {
                await waitForWritable(res);
                if (state.aborted)
                    return;
            }
        }
    }
    finally {
        reader.releaseLock();
    }
    if (!state.aborted)
        res.end();
}
function writeResponseStart(res, state, response) {
    if (state.aborted)
        return;
    res.cork(() => {
        if (state.aborted)
            return;
        writeStatus(res, response);
        for (let [key, value] of response.headers) {
            res.writeHeader(key, value);
        }
    });
}
function endUwsResponse(res, state, response, body) {
    if (state.aborted)
        return;
    res.cork(() => {
        if (state.aborted)
            return;
        writeStatus(res, response);
        for (let [key, value] of response.headers) {
            res.writeHeader(key, value);
        }
        if (body == null) {
            res.endWithoutBody();
        }
        else {
            res.end(body);
        }
    });
}
function writeChunk(res, state, chunk) {
    if (state.aborted)
        return true;
    return res.write(chunk);
}
function waitForWritable(res) {
    return new Promise((resolve) => {
        res.onWritable(() => {
            resolve();
            return true;
        });
    });
}
async function sendErrorResponse(res, state, method, onError, error) {
    let response = await createErrorResponse(onError, error);
    await sendUwsResponse(res, state, method, response);
}
async function createErrorResponse(onError, error) {
    try {
        return (await onError(error)) ?? internalServerError();
    }
    catch (error) {
        console.error(`There was an error in the error handler: ${error}`);
        return internalServerError();
    }
}
function defaultErrorHandler(error) {
    console.error(error);
    return internalServerError();
}
function internalServerError() {
    return new Response(new Uint8Array(internalServerErrorBody), {
        status: 500,
        headers: {
            'Content-Type': 'text/plain',
        },
    });
}
function isPromiseLike(value) {
    return typeof value.then === 'function';
}
function createUwsResponseState(res) {
    let state = {
        aborted: false,
        abortBody: undefined,
        controller: undefined,
    };
    res.onAborted(() => {
        state.aborted = true;
        state.controller?.abort();
        state.abortBody?.();
    });
    return state;
}
function createClientAddress(res) {
    let address = Buffer.from(res.getRemoteAddressAsText()).toString();
    return {
        address,
        family: address.includes(':') ? 'IPv6' : 'IPv4',
        port: res.getRemotePort(),
    };
}
function writeStatus(res, response) {
    if (response.status !== 200 || response.statusText !== '') {
        res.writeStatus(createStatusLine(response));
    }
}
function createStatusLine(response) {
    let statusText = response.statusText || STATUS_CODES[response.status] || '';
    return statusText === '' ? String(response.status) : `${response.status} ${statusText}`;
}
