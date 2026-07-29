import * as http from 'node:http';
import { createRequestListener } from "./request-listener.js";
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
export function createTestServer(handler) {
    return new Promise((resolve, reject) => {
        let server = http.createServer(createRequestListener((request) => handler(request)));
        server.listen(0, '127.0.0.1', () => {
            let addr = server.address();
            resolve({
                baseUrl: `http://127.0.0.1:${addr.port}`,
                close: () => new Promise((r, rj) => server.close((e) => (e ? rj(e) : r()))),
            });
        });
        server.on('error', reject);
    });
}
