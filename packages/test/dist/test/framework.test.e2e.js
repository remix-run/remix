import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/component/jsx-runtime";
import assert from '@remix-run/assert';
import { renderToString } from '@remix-run/component/server';
import { createRouter } from '@remix-run/fetch-router';
import { route } from '@remix-run/fetch-router/routes';
import { describe, it } from "../lib/framework.js";
const html = async (n) => new Response(await renderToString(n), {
    headers: { 'Content-Type': 'text/html' },
});
describe('e2e tests', () => {
    it('runs playwright against a fetch-router instance', async (t) => {
        function Doc() {
            return ({ children }) => (_jsxs("html", { children: [
                    _jsx("head", { children: _jsx("title", { children: "Test" }) }), _jsx("body", { children: children })
                ] }));
        }
        let routes = route({ home: '/', about: '/about' });
        let router = createRouter();
        router.get(routes.home, async () => html(_jsxs(Doc, { children: [
                _jsx("h1", { children: "Hello Remix" }), _jsx("a", { href: "/about", children: "About" })
            ] })));
        router.get(routes.about, async () => html(_jsx(Doc, { children: _jsx("h1", { children: "About Remix" }) })));
        let page = await t.serve(router.fetch);
        await page.goto('/');
        assert.equal(await page.locator('h1').textContent(), 'Hello Remix');
        await page.click('[href="/about"]');
        assert.equal(await page.locator('h1').textContent(), 'About Remix');
    });
});
