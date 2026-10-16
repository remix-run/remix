/*
 * Authored by Alex Hultman, 2018-2026.
 * Intellectual property of third-party.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** Native type representing a raw uSockets struct us_listen_socket_t.
 * Careful with this one, it is entirely unchecked and native so invalid usage will blow up.
 */
export interface us_listen_socket {

}

/** Native type representing a raw uSockets struct us_socket_t.
 * Careful with this one, it is entirely unchecked and native so invalid usage will blow up.
 */
export interface us_socket {

}

/** Native type representing a raw uSockets struct us_socket_context_t.
 * Used while upgrading a WebSocket manually. */
export interface us_socket_context_t {

}

/** Native type representing a raw uWebSockets struct AppDescriptor.
 * Used internally for worker thread distribution.
 * Careful with this one, it is entirely unchecked and native so invalid usage will blow up.
 */
export interface AppDescriptor {

}

/** Recognized string types, things C++ can read and understand as strings.
 * "String" does not have to mean "text", it can also be "binary".
 *
 * Ironically, JavaScript strings are the least performant of all options, to pass or receive to/from C++.
 * This because we expect UTF-8, which is packed in 8-byte chars. JavaScript strings are UTF-16 internally meaning extra copies and reinterpretation are required.
 *
 * That's why all events pass data by ArrayBuffer and not JavaScript strings, as they allow zero-copy data passing.
 *
 * You can always do Buffer.from(arrayBuffer).toString(), but keeping things binary and as ArrayBuffer is preferred.
 */
export type RecognizedString = string | ArrayBuffer | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array;

/** A WebSocket connection that is valid from open to close event.
 * Read more about this in the user manual.
 */
export interface WebSocket<UserData> {
    /** Sends a message. Returns 1 for success, 2 for dropped due to backpressure limit, and 0 for built up backpressure that will drain over time. You can check backpressure before or after sending by calling getBufferedAmount().
     *
     * Make sure you properly understand the concept of backpressure. Check the backpressure example file.
     */
    send(message: RecognizedString, isBinary?: boolean, compress?: boolean) : number;

    /** Returns the bytes buffered in backpressure. This is similar to the bufferedAmount property in the browser counterpart.
     * Check backpressure example.
     */
    getBufferedAmount() : number;

    /** Gracefully closes this WebSocket. Immediately calls the close handler.
     * A WebSocket close message is sent with code and shortMessage.
     */
    end(code?: number, shortMessage?: RecognizedString) : void;

    /** Forcefully closes this WebSocket. Immediately calls the close handler.
     * No WebSocket close message is sent.
     */
    close() : void;

    /** Sends a ping control message. Returns sendStatus similar to WebSocket.send (regarding backpressure). This helper function correlates to WebSocket::send(message, uWS::OpCode::PING, ...) in C++. */
    ping(message?: RecognizedString) : number;

    /** Subscribe to a topic. */
    subscribe(topic: RecognizedString) : boolean;

    /** Unsubscribe from a topic. Returns true on success, if the WebSocket was subscribed. */
    unsubscribe(topic: RecognizedString) : boolean;

    /** Returns whether this websocket is subscribed to topic. */
    isSubscribed(topic: RecognizedString) : boolean;

    /** Returns a list of topics this websocket is subscribed to. */
    getTopics() : string[];

    /** Publish a message under topic. Backpressure is managed according to maxBackpressure, closeOnBackpressureLimit settings.
     * Order is guaranteed since v20.
    */
    publish(topic: RecognizedString, message: RecognizedString, isBinary?: boolean, compress?: boolean) : boolean;

    /** See HttpResponse.cork. Takes a function in which the socket is corked (packing many sends into one single syscall/SSL block) */
    cork(cb: () => void) : WebSocket<UserData>;

    /** Returns the remote IP address. Note that the returned IP is binary, not text.
     *
     * IPv4 is 4 byte long and can be converted to text by printing every byte as a digit between 0 and 255.
     * IPv6 is 16 byte long and can be converted to text in similar ways, but you typically print digits in HEX.
     *
     * See getRemoteAddressAsText() for a text version.
     */
    getRemoteAddress() : ArrayBuffer;

    /** Returns the remote IP address as text. See RecognizedString. */
    getRemoteAddressAsText() : ArrayBuffer;

    /** Returns the remote port number. */
    getRemotePort() : number;

    /** Returns the UserData object. */
    getUserData() : UserData;

    /** Sends the first fragment of a fragmented message. Use for sending large messages in chunks.
     * Returns 1 for success, 2 for dropped due to backpressure limit, and 0 for built up backpressure.
     */
    sendFirstFragment(message: RecognizedString, isBinary?: boolean, compress?: boolean) : number;

    /** Sends a middle fragment of a fragmented message.
     * Returns 1 for success, 2 for dropped due to backpressure limit, and 0 for built up backpressure.
     */
    sendFragment(message: RecognizedString, compress?: boolean) : number;

    /** Sends the last fragment of a fragmented message.
     * Returns 1 for success, 2 for dropped due to backpressure limit, and 0 for built up backpressure.
     */
    sendLastFragment(message: RecognizedString, compress?: boolean) : number;
}

/** An HttpResponse is valid until either onAborted callback or any of the .end/.tryEnd calls succeed. You may attach user data to this object. */
export interface HttpResponse {
    /** Writes the HTTP status message such as "200 OK".
     * This has to be called first in any response, otherwise
     * it will be called automatically with "200 OK".
     *
     * If you want to send custom headers in a WebSocket
     * upgrade response, you have to call writeStatus with
     * "101 Switching Protocols" before you call writeHeader,
     * otherwise your first call to writeHeader will call
     * writeStatus with "200 OK" and the upgrade will fail.
     *
     * As you can imagine, we format outgoing responses in a linear
     * buffer, not in a hash table. You can read about this in
     * the user manual under "corking".
    */
    writeStatus(status: RecognizedString) : HttpResponse;
    /** Writes key and value to HTTP response.
     * See writeStatus and corking.
    */
    writeHeader(key: RecognizedString, value: RecognizedString) : HttpResponse;
    /** Enters or continues chunked encoding mode. Writes part of the response. End with zero length write. Returns true if no backpressure was added. */
    write(chunk: RecognizedString) : boolean;
    /** Ends this response by copying the contents of body. */
    end(body?: RecognizedString, closeConnection?: boolean) : HttpResponse;
    /** Ends this response without a body. */
    endWithoutBody(reportedContentLength?: number, closeConnection?: boolean) : HttpResponse;
    /** Ends this response, or tries to, by streaming appropriately sized chunks of body. Use in conjunction with onWritable. Returns tuple [ok, hasResponded].*/
    tryEnd(fullBodyOrChunk: RecognizedString, totalSize: number) : [boolean, boolean];

    /** Immediately force closes the connection. Any onAborted callback will run. */
    close() : HttpResponse;

    /** Returns the global byte write offset for this response. Use with onWritable. */
    getWriteOffset() : number;

    /** Registers a handler for writable events. Continue failed write attempts in here.
     * You MUST return true for success, false for failure.
     * Writing nothing is always success, so by default you must return true.
     */
    onWritable(handler: (offset: number) => boolean) : HttpResponse;

    /** Every HttpResponse MUST have an attached abort handler IF you do not respond
     * to it immediately inside of the callback. Returning from an Http request handler
     * without attaching (by calling onAborted) an abort handler is ill-use and will terminate.
     * When this event emits, the response has been aborted and may not be used. */
    onAborted(handler: () => void) : HttpResponse;

    /** Handler for reading HTTP request body data.
     * Must be attached before performing any asynchronous operation, otherwise data may be lost.
     * You MUST copy the data of chunk if isLast is not true. We Neuter ArrayBuffers on return, making them zero length. */
    onData(handler: (chunk: ArrayBuffer, isLast: boolean) => void) : HttpResponse;
    
    /** Pause HTTP request body streaming (throttle).
     * Some buffered data may still be sent to onData. */
    pause() : void;
    
    /** Resume HTTP request body streaming (unthrottle). */
    resume() : void;

    /** collectBody is a helper function making optimal use of the new onDataV2.
     * It allows efficient and easy collection of smallish HTTP request body data into RAM.
     * It accumulates all data chunks and calls handler with the complete body as an ArrayBuffer once all data has arrived.
     * If the total body size exceeds maxSize bytes, handler is called with null instead. */
    collectBody(maxSize: number, handler: (fullBody: ArrayBuffer | null) => void) : HttpResponse;

    /** Handler for reading HTTP request body data. V2.
     * Must be attached before performing any asynchronous operation, otherwise data may be lost.
     * You MUST copy the data of chunk if maxRemainingBodyLength is not 0n. We Neuter ArrayBuffers on return, making them zero length.
     * maxRemainingBodyLength is the known maximum of the remaining body length. Can be used to preallocate a receive buffer.
     */
    onDataV2(handler: (chunk: ArrayBuffer, maxRemainingBodyLength: bigint) => void) : HttpResponse;

    /** Returns the remote IP address in binary format (4 or 16 bytes). */
    getRemoteAddress() : ArrayBuffer;

    /** Returns the remote IP address as text. */
    getRemoteAddressAsText() : ArrayBuffer;

    /** Returns the remote port number. */
    getRemotePort() : number;

    /** Returns the remote IP address in binary format (4 or 16 bytes), as reported by the PROXY Protocol v2 compatible proxy. */
    getProxiedRemoteAddress() : ArrayBuffer;

    /** Returns the remote IP address as text, as reported by the PROXY Protocol v2 compatible proxy. */
    getProxiedRemoteAddressAsText() : ArrayBuffer;

    /** Returns the remote port number, as reported by the PROXY Protocol v2 compatible proxy. */
    getProxiedRemotePort() : number;

    /** Corking a response is a performance improvement in both CPU and network, as you ready the IO system for writing multiple chunks at once.
     * By default, you're corked in the immediately executing top portion of the route handler. In all other cases, such as when returning from
     * await, or when being called back from an async database request or anything that isn't directly executing in the route handler, you'll want
     * to cork before calling writeStatus, writeHeader or just write. Corking takes a callback in which you execute the writeHeader, writeStatus and
     * such calls, in one atomic IO operation. This is important, not only for TCP but definitely for TLS where each write would otherwise result
     * in one TLS block being sent off, each with one send syscall.
     *
     * Example usage:
     *
     * ```
     * res.cork(() => {
     *   res.writeStatus("200 OK").writeHeader("Some", "Value").write("Hello world!");
     * });
     * ```
     */
    cork(cb: () => void) : HttpResponse;

    /** Upgrades a HttpResponse to a WebSocket. See UpgradeAsync, UpgradeSync example files. */
    upgrade<UserData>(userData : UserData, secWebSocketKey: RecognizedString, secWebSocketProtocol: RecognizedString, secWebSocketExtensions: RecognizedString, context: us_socket_context_t) : void;

    /** Arbitrary user data may be attached to this object */
    [key: string]: any;
}

/** An HttpRequest is stack allocated and only accessible during the callback invocation. */
export interface HttpRequest {
    /** Returns the lowercased header value or empty string. */
    getHeader(lowerCaseKey: RecognizedString) : string;
    /** Returns the parsed parameter at index. Corresponds to route. Can also take the name of the parameter. */
    getParameter(index: number | RecognizedString) : string | undefined;
    /** Returns the URL including initial /slash */
    getUrl() : string;
    /** Returns the lowercased HTTP method, useful for "any" routes. */
    getMethod() : string;
    /** Returns the HTTP method as-is. */
    getCaseSensitiveMethod() : string;
    /** Returns the raw querystring (the part of URL after ? sign) or empty string. */
    getQuery() : string;
    /** Returns a decoded query parameter value or undefined. */
    getQuery(key: string) : string | undefined;
    /** Loops over all headers. */
    forEach(cb: (key: string, value: string) => void) : void;
    /** Setting yield to true is to say that this route handler did not handle the route, causing the router to continue looking for a matching route handler, or fail. */
    setYield(_yield: boolean) : HttpRequest;
}

/** A structure holding settings and handlers for a WebSocket URL route handler. */
export interface WebSocketBehavior<UserData> {
    /** Maximum length of received message. If a client tries to send you a message larger than this, the connection is immediately closed. Defaults to 16 * 1024. */
    maxPayloadLength?: number;
    /** Whether or not we should automatically close the socket when a message is dropped due to backpressure. Defaults to false. */
    closeOnBackpressureLimit?: boolean;
    /** Maximum number of minutes a WebSocket may be connected before being closed by the server. 0 disables the feature. Valid values are 0 and 1-239. */
    maxLifetime?: number;
    /** Maximum amount of seconds that may pass without sending or getting a message. Connection is closed if this timeout passes. Resolution (granularity) for timeouts are typically 4 seconds, rounded to closest.
     * Disable by using 0. Defaults to 120.
     */
    idleTimeout?: number;
    /** What permessage-deflate compression to use. uWS.DISABLED, uWS.SHARED_COMPRESSOR or any of the uWS.DEDICATED_COMPRESSOR_xxxKB. Defaults to uWS.DISABLED. */
    compression?: CompressOptions;
    /** Maximum length of allowed backpressure per socket when publishing or sending messages. Slow receivers with too high backpressure will be skipped until they catch up or timeout. Defaults to 64 * 1024. */
    maxBackpressure?: number;
    /** Whether or not we should automatically send pings to uphold a stable connection given whatever idleTimeout. */
    sendPingsAutomatically?: boolean;
    /** Upgrade handler used to intercept HTTP upgrade requests and potentially upgrade to WebSocket.
     * See UpgradeAsync and UpgradeSync example files.
     */
    upgrade?: (res: HttpResponse, req: HttpRequest, context: us_socket_context_t) => void | Promise<void>;
    /** Handler for new WebSocket connection. WebSocket is valid from open to close, no errors. */
    open?: (ws: WebSocket<UserData>) => void | Promise<void>;
    /** Handler for a WebSocket message. Messages are given as ArrayBuffer no matter if they are binary or not. Given ArrayBuffer is valid during the lifetime of this callback (until first await or return) and will be neutered. */
    message?: (ws: WebSocket<UserData>, message: ArrayBuffer, isBinary: boolean) => void | Promise<void>;
    /** Handler for a dropped WebSocket message. Messages can be dropped due to specified backpressure settings. Messages are given as ArrayBuffer no matter if they are binary or not. Given ArrayBuffer is valid during the lifetime of this callback (until first await or return) and will be neutered. */
    dropped?: (ws: WebSocket<UserData>, message: ArrayBuffer, isBinary: boolean) => void | Promise<void>;
    /** Handler for when WebSocket backpressure drains. Check ws.getBufferedAmount(). Use this to guide / drive your backpressure throttling. */
    drain?: (ws: WebSocket<UserData>) => void;
    /** Handler for close event, no matter if error, timeout or graceful close. You may not use WebSocket after this event. Do not send on this WebSocket from within here, it is closed. */
    close?: (ws: WebSocket<UserData>, code: number, message: ArrayBuffer) => void;
    /** Handler for received ping control message. You do not need to handle this, pong messages are automatically sent as per the standard. */
    ping?: (ws: WebSocket<UserData>, message: ArrayBuffer) => void;
    /** Handler for received pong control message. */
    pong?: (ws: WebSocket<UserData>, message: ArrayBuffer) => void;
    /** Handler for subscription changes. */
    subscription?: (ws: WebSocket<UserData>, topic: ArrayBuffer, newCount: number, oldCount: number) => void;
}

/** Options used when constructing an app. Especially for SSLApp.
 * These are options passed directly to uSockets, C layer.
 */
export interface AppOptions {
    key_file_name?: RecognizedString;
    cert_file_name?: RecognizedString;
    ca_file_name?: RecognizedString;
    passphrase?: RecognizedString;
    dh_params_file_name?: RecognizedString;
    ssl_ciphers?: RecognizedString;
    /** This translates to SSL_MODE_RELEASE_BUFFERS */
    ssl_prefer_low_memory_usage?: boolean;
}

export enum ListenOptions {
  LIBUS_LISTEN_DEFAULT = 0,
  LIBUS_LISTEN_EXCLUSIVE_PORT = 1
}

/** TemplatedApp is either an SSL or non-SSL app. See App for more info, read user manual. */
export interface TemplatedApp {
    /** Listens to hostname & port. Callback hands either false or a listen socket. */
    listen(host: RecognizedString, port: number, cb: (listenSocket: us_listen_socket | false) => void | Promise<void>) : TemplatedApp;
    /** Listens to hostname & port and sets Listen Options. Callback hands either false or a listen socket. */
    listen(host: RecognizedString, port: number, options: ListenOptions, cb: (listenSocket: us_listen_socket | false) => void | Promise<void>) : TemplatedApp;
    /** Listens to port. Callback hands either false or a listen socket. */
    listen(port: number, cb: (listenSocket: us_listen_socket | false) => void | Promise<void>) : TemplatedApp;
    /** Listens to port and sets Listen Options. Callback hands either false or a listen socket. */
    listen(port: number, options: ListenOptions, cb: (listenSocket: us_listen_socket | false) => void | Promise<void>) : TemplatedApp;
    /** Listens to unix socket. Callback hands either false or a listen socket. */
    listen_unix(cb: (listenSocket: us_listen_socket) => void | Promise<void>, path: RecognizedString) : TemplatedApp;
    /** Registers an HTTP GET handler matching specified URL pattern. */
    get(pattern: RecognizedString, handler: (res: HttpResponse, req: HttpRequest) => void | Promise<void>) : TemplatedApp;
    /** Registers an HTTP POST handler matching specified URL pattern. */
    post(pattern: RecognizedString, handler: (res: HttpResponse, req: HttpRequest) => void | Promise<void>) : TemplatedApp;
    /** Registers an HTTP OPTIONS handler matching specified URL pattern. */
    options(pattern: RecognizedString, handler: (res: HttpResponse, req: HttpRequest) => void | Promise<void>) : TemplatedApp;
    /** Registers an HTTP DELETE handler matching specified URL pattern. */
    del(pattern: RecognizedString, handler: (res: HttpResponse, req: HttpRequest) => void | Promise<void>) : TemplatedApp;
    /** Registers an HTTP PATCH handler matching specified URL pattern. */
    patch(pattern: RecognizedString, handler: (res: HttpResponse, req: HttpRequest) => void | Promise<void>) : TemplatedApp;
    /** Registers an HTTP PUT handler matching specified URL pattern. */
    put(pattern: RecognizedString, handler: (res: HttpResponse, req: HttpRequest) => void | Promise<void>) : TemplatedApp;
    /** Registers an HTTP HEAD handler matching specified URL pattern. */
    head(pattern: RecognizedString, handler: (res: HttpResponse, req: HttpRequest) => void | Promise<void>) : TemplatedApp;
    /** Registers an HTTP CONNECT handler matching specified URL pattern. */
    connect(pattern: RecognizedString, handler: (res: HttpResponse, req: HttpRequest) => void | Promise<void>) : TemplatedApp;
    /** Registers an HTTP TRACE handler matching specified URL pattern. */
    trace(pattern: RecognizedString, handler: (res: HttpResponse, req: HttpRequest) => void | Promise<void>) : TemplatedApp;
    /** Registers an HTTP handler matching specified URL pattern on any HTTP method. */
    any(pattern: RecognizedString, handler: (res: HttpResponse, req: HttpRequest) => void | Promise<void>) : TemplatedApp;
    /** Registers a handler matching specified URL pattern where WebSocket upgrade requests are caught. */
    ws<UserData>(pattern: RecognizedString, behavior: WebSocketBehavior<UserData>) : TemplatedApp;
    /** Publishes a message under topic, for all WebSockets under this app. See WebSocket.publish. */
    publish(topic: RecognizedString, message: RecognizedString, isBinary?: boolean, compress?: boolean) : boolean;
    /** Returns number of subscribers for this topic. */
    numSubscribers(topic: RecognizedString) : number;
    /** Adds a server name. */
    addServerName(hostname: string, options: AppOptions) : TemplatedApp;
    /** Browse to SNI domain. Used together with .get, .post and similar to attach routes under SNI domains. */
    domain(domain: string) : TemplatedApp;
    /** Removes a server name. */
    removeServerName(hostname: string) : TemplatedApp;
    /** Registers a synchronous callback on missing server names. See /examples/ServerName.js. */
    missingServerName(cb: (hostname: string) => void) : TemplatedApp;
    /** Attaches a "filter" function to track socket connections / disconnections */
    filter(cb: (res: HttpResponse, count: Number) => void | Promise<void>) : TemplatedApp;
    /** Closes all sockets including listen sockets. This will forcefully terminate all connections. */
    close() : TemplatedApp;
    /** Returns the app descriptor for worker thread distribution. */
    getDescriptor(): AppDescriptor;
    /** Add a child app descriptor for worker thread distribution. */
    addChildAppDescriptor(descriptor: AppDescriptor): void;
    /** Remove a child app descriptor. */
    removeChildAppDescriptor(descriptor: AppDescriptor): void;
}

/** Constructs a non-SSL app. An app is your starting point where you attach behavior to URL routes.
 * This is also where you listen and run your app, set any SSL options (in case of SSLApp) and the like.
 */
export function App(options?: AppOptions) : TemplatedApp;

/** Constructs an SSL app. See App. */
export function SSLApp(options: AppOptions) : TemplatedApp;

/** Closes a uSockets listen socket. */
export function us_listen_socket_close(listenSocket: us_listen_socket) : void;

/** Gets local port of socket (or listenSocket) or -1. */
export function us_socket_local_port(socket: us_socket | us_listen_socket) : number;

export interface MultipartField {
    data: ArrayBuffer;
    name: string;
    type?: string;
    filename?: string;
}

/** Takes a POSTed body and contentType, and returns an array of parts if the request is a multipart request */
export function getParts(body: RecognizedString, contentType: RecognizedString) : MultipartField[] | undefined;

/** WebSocket compression options. Combine any compressor with any decompressor using bitwise OR. */
export type CompressOptions = number;
/** No compression (always a good idea if you operate using an efficient binary protocol) */
export var DISABLED: CompressOptions;
/** Zero memory overhead compression. */
export var SHARED_COMPRESSOR: CompressOptions;
/** Zero memory overhead decompression. */
export var SHARED_DECOMPRESSOR: CompressOptions;
/** Sliding dedicated compress window, requires 3KB of memory per socket */
export var DEDICATED_COMPRESSOR_3KB: CompressOptions;
/** Sliding dedicated compress window, requires 4KB of memory per socket */
export var DEDICATED_COMPRESSOR_4KB: CompressOptions;
/** Sliding dedicated compress window, requires 8KB of memory per socket */
export var DEDICATED_COMPRESSOR_8KB: CompressOptions;
/** Sliding dedicated compress window, requires 16KB of memory per socket */
export var DEDICATED_COMPRESSOR_16KB: CompressOptions;
/** Sliding dedicated compress window, requires 32KB of memory per socket */
export var DEDICATED_COMPRESSOR_32KB: CompressOptions;
/** Sliding dedicated compress window, requires 64KB of memory per socket */
export var DEDICATED_COMPRESSOR_64KB: CompressOptions;
/** Sliding dedicated compress window, requires 128KB of memory per socket */
export var DEDICATED_COMPRESSOR_128KB: CompressOptions;
/** Sliding dedicated compress window, requires 256KB of memory per socket */
export var DEDICATED_COMPRESSOR_256KB: CompressOptions;
/** Sliding dedicated decompress window, requires 32KB of memory per socket (plus about 23KB) */
export var DEDICATED_DECOMPRESSOR_32KB: CompressOptions;
/** Sliding dedicated decompress window, requires 16KB of memory per socket (plus about 23KB) */
export var DEDICATED_DECOMPRESSOR_16KB: CompressOptions;
/** Sliding dedicated decompress window, requires 8KB of memory per socket (plus about 23KB) */
export var DEDICATED_DECOMPRESSOR_8KB: CompressOptions;
/** Sliding dedicated decompress window, requires 4KB of memory per socket (plus about 23KB) */
export var DEDICATED_DECOMPRESSOR_4KB: CompressOptions;
/** Sliding dedicated decompress window, requires 2KB of memory per socket (plus about 23KB) */
export var DEDICATED_DECOMPRESSOR_2KB: CompressOptions;
/** Sliding dedicated decompress window, requires 1KB of memory per socket (plus about 23KB) */
export var DEDICATED_DECOMPRESSOR_1KB: CompressOptions;
/** Sliding dedicated decompress window, requires 512B of memory per socket (plus about 23KB) */
export var DEDICATED_DECOMPRESSOR_512B: CompressOptions;
/** Sliding dedicated decompress window, requires 32KB of memory per socket (plus about 23KB) */
export var DEDICATED_DECOMPRESSOR: CompressOptions;

/**
 * Environment variables recognized by uWebSockets.js.
 *
 * These can be set in the process environment before starting the server.
 */
export namespace EnvironmentVariables {
    /** Maximum total byte size of HTTP request headers. This is a runtime env variable. Default: 4096. */
    const UWS_HTTP_MAX_HEADERS_SIZE: string | undefined;
    /** Maximum number of HTTP request headers. This is a compile-time define, not a runtime env variable. Default: 100. */
    const UWS_HTTP_MAX_HEADERS_COUNT: string | undefined;
}
