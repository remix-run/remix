/**
 * Result returned by {@link createTestServer}.
 */
export interface TestServer {
    /**
     * The base URL the server is listening on, e.g. `http://127.0.0.1:54321`.
     */
    baseUrl: string;
    /**
     * Stops the server and resolves once all in-flight connections have closed.
     */
    close(): Promise<void>;
}
/**
 * Starts an `http.Server` on a random localhost port that delegates to the
 * given fetch-style handler. Intended for integration tests — pair the
 * returned {@link TestServer} with `t.serve()` from `@remix-run/test` to
 * drive it from a Playwright `Page`.
 *
 * @param handler - A fetch-style `(request) => Response | Promise<Response>`
 *   (e.g. `router.fetch` from `@remix-run/fetch-router`)
 * @returns A promise that resolves to the running {@link TestServer}.
 */
export declare function createTestServer(handler: (request: Request) => Response | Promise<Response>): Promise<TestServer>;
//# sourceMappingURL=test-server.d.ts.map