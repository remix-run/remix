import * as assert from 'node:assert/strict';
import { createTestServer } from '@remix-run/node-fetch-server/test';
import { describe, it } from "../lib/framework.js";
function html(body) {
    return new Response([
        '<!doctype html>',
        '<html>',
        '<head>',
        '<title>Test</title>',
        '</head>',
        '<body>',
        body,
        '</body>',
        '</html>',
    ].join(''), {
        headers: { 'Content-Type': 'text/html' },
    });
}
function notFound() {
    return new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
    });
}
describe('e2e tests', () => {
    it('runs playwright against a fetch handler', async (t) => {
        let handler = (request) => {
            let url = new URL(request.url);
            if (url.pathname === '/') {
                return html('<h1>Hello Remix</h1><a href="/about">About</a>');
            }
            if (url.pathname === '/about') {
                return html('<h1>About Remix</h1>');
            }
            return notFound();
        };
        let page = await t.serve(await createTestServer(handler));
        await page.goto('/');
        assert.equal(await page.locator('h1').textContent(), 'Hello Remix');
        await page.click('[href="/about"]');
        assert.equal(await page.locator('h1').textContent(), 'About Remix');
    });
});
