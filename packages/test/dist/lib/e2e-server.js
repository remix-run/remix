import * as http from 'node:http';
import { createRequestListener } from '@remix-run/node-fetch-server';
export function createServer(handler) {
    return new Promise((resolve, reject) => {
        let server = http.createServer(createRequestListener(handler));
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
