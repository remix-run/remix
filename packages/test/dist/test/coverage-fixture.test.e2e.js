import * as assert from '@remix-run/assert';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from "../lib/framework.js";
import { transformTypeScript } from "../lib/ts-transform.js";
// Expected coverage for coverage-fixture.ts (same as the server fixture test):
//
//   add             — 100% functions, statements, lines, branches
//   classify        — function covered, but only the `n > 0` branch is hit
//   uncalledFunction — 0% across the board (never called)
//   greet           — function covered, but only the truthy `name` branch is hit
describe('e2e coverage fixture', () => {
    it('exercises some but not all code paths in the browser', async (t) => {
        // Compile the fixture TypeScript to browser-ready JS
        let fixturePath = path.resolve(import.meta.dirname, './coverage-fixture.ts');
        let fixtureSource = await fsp.readFile(fixturePath, 'utf-8');
        let { code: fixtureJs } = await transformTypeScript(fixtureSource, fixturePath);
        let page = await t.serve(async (req) => {
            let url = new URL(req.url);
            if (url.pathname === '/') {
                return new Response(`<!doctype html>
<html>
<body>
  <div id="result"></div>
  <script type="module">
    import { add, classify, greet } from '/src/test/coverage-fixture.ts'

    // Exercise the same paths as the server fixture test:
    // - add: fully covered
    // - classify: only positive branch
    // - greet: only with a name
    // - uncalledFunction: never imported
    let results = [
      add(2, 3),
      add(-1, 1),
      classify(42),
      classify(1),
      greet('World'),
    ]
    document.getElementById('result').textContent = results.join(',')
  </script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html' } });
            }
            // Serve the compiled fixture at the path the import expects
            if (url.pathname === '/src/test/coverage-fixture.ts') {
                return new Response(fixtureJs, {
                    headers: { 'Content-Type': 'application/javascript' },
                });
            }
            return new Response('Not found', { status: 404 });
        });
        await page.goto('/');
        let result = await page.locator('#result').textContent();
        assert.equal(result, '5,0,positive,positive,Hello, World!');
    });
});
