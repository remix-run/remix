import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/component/jsx-runtime";
import * as assert from 'node:assert/strict';
import { renderToString } from '@remix-run/component/server';
import { describe, it } from "../lib/framework.js";
const html = async (n) => new Response(await renderToString(n), {
    headers: { 'Content-Type': 'text/html' },
});
describe('e2e tests', () => {
    it('runs playwright against a fetch handler', async (t) => {
        function Doc() {
            return ({ children }) => (_jsxs("html", { children: [
                    _jsx("head", { children: _jsx("title", { children: "Test" }) }), _jsx("body", { children: children })
                ] }));
        }
        let page = await t.serve(async (request) => {
            let url = new URL(request.url);
            if (url.pathname === '/') {
                return html(_jsxs(Doc, { children: [
                        _jsx("h1", { children: "Hello Remix" }), _jsx("a", { href: "/about", children: "About" })
                    ] }));
            }
            if (url.pathname === '/about') {
                return html(_jsx(Doc, { children: _jsx("h1", { children: "About Remix" }) }));
            }
            return new Response('Not found', { status: 404 });
        });
        await page.goto('/');
        assert.equal(await page.locator('h1').textContent(), 'Hello Remix');
        await page.click('[href="/about"]');
        assert.equal(await page.locator('h1').textContent(), 'About Remix');
    });
});
