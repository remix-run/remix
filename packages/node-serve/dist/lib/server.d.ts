import * as uWS from 'uWebSockets.js';
import type { ErrorHandler, FetchHandler } from './fetch-handler.ts';
/**
 * Options for `createUwsRequestHandler()`.
 */
export interface UwsRequestHandlerOptions {
    /**
     * Overrides the host portion of the incoming request URL. By default the request URL host is
     * derived from the HTTP `Host` header.
     */
    host?: string;
    /**
     * Overrides the protocol of the incoming request URL. Defaults to `http:`.
     */
    protocol?: string;
    /**
     * An error handler that determines the response when the request handler throws an error. By
     * default a 500 Internal Server Error response will be sent.
     */
    onError?: ErrorHandler;
}
/**
 * A route handler returned by `createUwsRequestHandler()`.
 */
export interface UwsRequestHandler {
    (res: uWS.HttpResponse, req: uWS.HttpRequest): void;
}
/**
 * TLS certificate options for an HTTPS server.
 */
export interface ServeTlsOptions {
    /**
     * The path to the private key file to use for TLS.
     */
    keyFile: string;
    /**
     * The path to the certificate file to use for TLS.
     */
    certFile: string;
    /**
     * The path to a CA certificate file to use for TLS.
     */
    caFile?: string;
    /**
     * The passphrase to use when the private key is encrypted.
     */
    passphrase?: string;
}
/**
 * Options for a server created with `serve()`.
 */
export interface ServeOptions {
    /**
     * Overrides the host portion of the incoming request URL. By default the request URL host is
     * derived from the HTTP `Host` header.
     */
    host?: string;
    /**
     * Overrides the protocol of the incoming request URL. Defaults to `http:` or `https:` when `tls`
     * is provided.
     */
    protocol?: string;
    /**
     * An error handler that determines the response when the request handler throws an error. By
     * default a 500 Internal Server Error response will be sent.
     */
    onError?: ErrorHandler;
    /**
     * The hostname or IP address to listen on. By default the server listens on all interfaces.
     */
    listenHost?: string;
    /**
     * The TCP port to listen on. Defaults to 3000.
     */
    port?: number;
    /**
     * TLS options. When provided, the server accepts HTTPS requests and incoming request URLs default
     * to the `https:` protocol.
     */
    tls?: ServeTlsOptions;
}
/**
 * A running Node.js server created by `serve()`.
 */
export interface Server {
    /**
     * The underlying native server application for advanced transport-specific customization.
     */
    app: uWS.TemplatedApp;
    /**
     * A promise that resolves when the server has started listening.
     */
    ready: Promise<void>;
    /**
     * The active TCP port after `ready` resolves. This is useful when listening on port 0.
     */
    readonly port: number;
    /**
     * Closes the listening socket and active connections.
     */
    close(): void;
}
/**
 * Creates a route handler for an existing uWebSockets.js app from a Fetch API handler.
 *
 * @param handler The fetch handler to use for processing incoming requests
 * @param options Request handler options
 * @returns A route handler that can be registered on a uWebSockets.js app
 */
export declare function createUwsRequestHandler(handler: FetchHandler, options?: UwsRequestHandlerOptions): UwsRequestHandler;
/**
 * Starts a server that sends incoming requests to a Fetch API handler.
 *
 * @param handler The fetch handler to use for processing incoming requests
 * @param options Server options
 * @returns The running server
 */
export declare function serve(handler: FetchHandler, options?: ServeOptions): Server;
//# sourceMappingURL=server.d.ts.map