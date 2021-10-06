import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import * as Utils from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("thrown responses", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("no route matches", () => {
    it("renders root catch boundary without javascript", async () => {
      await Utils.disableJavaScript(page);
      let response = await page.goto(`${testServer}/route-does-not-exist`);
      expect(response!.status()).toBe(404);
      expect(await Utils.getHtml(page, '[data-test-id="app-catch-boundary"]'))
        .toMatchInlineSnapshot(`
        "<div data-test-id=\\"app-catch-boundary\\"><h1>404 Not Found</h1></div>
        "
      `);
    });

    it("renders root catch boundary with javascript", async () => {
      await page.goto(`${testServer}/`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/fart"]');
      await page.waitForSelector('[data-test-id="app-catch-boundary"]');

      expect(await Utils.getHtml(page, '[data-test-id="app-catch-boundary"]'))
        .toMatchInlineSnapshot(`
        "<div data-test-id=\\"app-catch-boundary\\"><h1>404 Not Found</h1></div>
        "
      `);
    });
  });

  describe("invalid request method", () => {
    it("renders root catch boundary without javascript", async () => {
      await Utils.disableJavaScript(page, request => {
        request.continue({
          method: "OPTIONS"
        });
      });

      let response = await page.goto(`${testServer}/`, {});
      expect(response!.status()).toBe(405);
      expect(await Utils.getHtml(page, '[data-test-id="app-catch-boundary"]'))
        .toMatchInlineSnapshot(`
        "<div data-test-id=\\"app-catch-boundary\\">
          <h1>
            405<!-- -->
            <!-- -->Method Not Allowed
          </h1>
        </div>
        "
      `);
    });

    it("renders root catch boundary without javascript for nested route", async () => {
      await Utils.disableJavaScript(page, request => {
        request.continue({
          method: "OPTIONS"
        });
      });

      let response = await page.goto(
        `${testServer}/loader-errors/nested-catch`,
        {}
      );
      expect(response!.status()).toBe(405);
      expect(await Utils.getHtml(page, '[data-test-id="app-catch-boundary"]'))
        .toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-catch-boundary\\">
            <h1>
              405<!-- -->
              <!-- -->Method Not Allowed
            </h1>
          </div>
          "
        `);
    });
  });

  describe("an action threw a response", () => {
    describe("in an action with a catch boundary", () => {
      it("renders the catch boundary without JavaScript", async () => {
        await Utils.disableJavaScript(page);
        await page.goto(`${testServer}/action-catches-self-boundary`);

        let [, response2] = await Promise.all([
          page.click("button[type=submit]"),
          page.waitForNavigation()
        ]);

        expect(response2!.status()).toBe(401);

        let html = await Utils.getHtml(
          page,
          '[data-test-id="/action-catches-self-boundary"]'
        );
        expect(html).toMatchInlineSnapshot(`
          "<div data-test-id=\\"/action-catches-self-boundary\\">
            <h1>Action Catches Self Boundary</h1>
            <p>
              Status:
              <!-- -->401
            </p>
            <pre><code>\\"action catch data!\\"</code></pre>
          </div>
          "
        `);
      });

      it("renders the catch boundary with JavaScript", async () => {
        await page.goto(`${testServer}/action-catches-self-boundary`);
        await Utils.reactIsHydrated(page);
        await page.click("button[type=submit]");
        await page.waitForSelector(
          '[data-test-id="/action-catches-self-boundary"]'
        );
        let html = await Utils.getHtml(
          page,
          '[data-test-id="/action-catches-self-boundary"]'
        );
        expect(html).toMatchInlineSnapshot(`
          "<div data-test-id=\\"/action-catches-self-boundary\\">
            <h1>Action Catches Self Boundary</h1>
            <p>Status: 401</p>
            <pre><code>\\"action catch data!\\"</code></pre>
          </div>
          "
        `);
      });
    });

    describe("in an action without a catch boundary", () => {
      it("renders the parent catch boundary without JavaScript", async () => {
        await Utils.disableJavaScript(page);
        await page.goto(`${testServer}/action-catches`);

        let [, response2] = await Promise.all([
          page.click("button[type=submit]"),
          page.waitForNavigation()
        ]);

        expect(response2!.status()).toBe(401);

        let html = await Utils.getHtml(
          page,
          '[data-test-id="app-catch-boundary"]'
        );
        expect(html).toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-catch-boundary\\">
            <h1>
              401<!-- -->
              <!-- -->Unauthorized
            </h1>
            <pre><code>\\"action catch data!\\"</code></pre>
          </div>
          "
        `);
      });

      it("renders the parent catch boundary with JavaScript", async () => {
        await page.goto(`${testServer}/action-catches`);
        await Utils.reactIsHydrated(page);
        await page.click("button[type=submit]");
        await page.waitForSelector('[data-test-id="app-catch-boundary"]');
        let html = await Utils.getHtml(
          page,
          '[data-test-id="app-catch-boundary"]'
        );
        expect(html).toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-catch-boundary\\">
            <h1>401 Unauthorized</h1>
            <pre><code>\\"action catch data!\\"</code></pre>
          </div>
          "
        `);
      });
    });
  });

  describe("a CatchBoundary with an Outlet", () => {
    it.todo("Does not render anything in the outlet");
  });

  describe("a loader threw a response", () => {
    describe("on a route without a CatchBoundary", () => {
      describe("after a successful action", () => {
        it("renders the parent CatchBoundary without javascript", async () => {
          await Utils.disableJavaScript(page);
          await page.goto(`${testServer}/action-catches-from-loader`);

          let [, response2] = await Promise.all([
            page.click("button[type=submit]"),
            page.waitForNavigation()
          ]);

          expect(response2!.status()).toBe(401);

          let html = await Utils.getHtml(
            page,
            '[data-test-id="app-catch-boundary"]'
          );
          expect(html).toMatchInlineSnapshot(`
            "<div data-test-id=\\"app-catch-boundary\\">
              <h1>
                401<!-- -->
                <!-- -->Unauthorized
              </h1>
              <pre><code>\\"loader catch data!\\"</code></pre>
            </div>
            "
          `);
        });

        it("with javascript", async () => {
          await page.goto(`${testServer}/action-catches-from-loader`);
          await Utils.reactIsHydrated(page);
          await Promise.all([page.click("button[type=submit]")]);
          await page.waitForSelector('[data-test-id="app-catch-boundary"]');

          let html = await Utils.getHtml(
            page,
            '[data-test-id="app-catch-boundary"]'
          );
          expect(html).toMatchInlineSnapshot(`
            "<div data-test-id=\\"app-catch-boundary\\">
              <h1>401 Unauthorized</h1>
              <pre><code>\\"loader catch data!\\"</code></pre>
            </div>
            "
          `);
        });
      });

      it("renders the root CatchBoundary on document requests", async () => {
        await Utils.disableJavaScript(page);
        let response = await page.goto(`${testServer}/loader-errors?catch`);
        expect(response!.status()).toBe(401);
        expect(await Utils.getHtml(page, '[data-test-id="app-catch-boundary"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-catch-boundary\\">
            <h1>
              401<!-- -->
              <!-- -->Unauthorized
            </h1>
            <pre><code>\\"catch data!\\"</code></pre>
          </div>
          "
        `);
      });

      it("renders root CatchBoundary on fetch requests", async () => {
        await page.goto(`${testServer}/`);
        await Utils.reactIsHydrated(page);

        let responses = Utils.collectDataResponses(
          page,
          "routes/loader-errors"
        );

        await page.click('a[href="/loader-errors?catch"]');
        await page.waitForSelector('[data-test-id="app-catch-boundary"]');

        expect(responses[0].status()).toBe(401);
        expect(await Utils.getHtml(page, '[data-test-id="app-catch-boundary"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-catch-boundary\\">
            <h1>401 Unauthorized</h1>
            <pre><code>\\"catch data!\\"</code></pre>
          </div>
          "
        `);
      });
    });

    describe("on a route with a CatchBoundary", () => {
      describe("after a successful action", () => {
        it("renders the routes CatchBoundary without javascript", async () => {
          await Utils.disableJavaScript(page);
          await page.goto(
            `${testServer}/action-catches-from-loader-self-boundary`
          );

          let [, response2] = await Promise.all([
            page.click("button[type=submit]"),
            page.waitForNavigation()
          ]);

          expect(response2!.status()).toBe(401);

          let html = await Utils.getHtml(
            page,
            '[data-test-id="/action-catches-from-loader-self-boundary"]'
          );
          expect(html).toMatchInlineSnapshot(`
            "<div data-test-id=\\"/action-catches-from-loader-self-boundary\\">
              <h1>Action Catches Self Boundary</h1>
              <p>
                Status:
                <!-- -->401
              </p>
              <pre><code>\\"loader catch data!\\"</code></pre>
            </div>
            "
          `);
        });

        it("with javascript", async () => {
          await page.goto(
            `${testServer}/action-catches-from-loader-self-boundary`
          );
          await Utils.reactIsHydrated(page);
          await Promise.all([page.click("button[type=submit]")]);
          await page.waitForSelector(
            '[data-test-id="/action-catches-from-loader-self-boundary"]'
          );

          let html = await Utils.getHtml(
            page,
            '[data-test-id="/action-catches-from-loader-self-boundary"]'
          );
          expect(html).toMatchInlineSnapshot(`
            "<div data-test-id=\\"/action-catches-from-loader-self-boundary\\">
              <h1>Action Catches Self Boundary</h1>
              <p>Status: 401</p>
              <pre><code>\\"loader catch data!\\"</code></pre>
            </div>
            "
          `);
        });
      });

      it("renders the route CatchBoundary on document requests", async () => {
        await Utils.disableJavaScript(page);
        let response = await page.goto(
          `${testServer}/loader-errors/nested-catch`
        );
        expect(response!.status()).toBe(401);
        expect(
          await Utils.getHtml(
            page,
            '[data-test-id="/loader-errors/nested-catch"]'
          )
        ).toMatchInlineSnapshot(`
          "<div data-test-id=\\"/loader-errors/nested-catch\\">
            <h2>Nested Catch Boundary</h2>
            <a href=\\"/loader-errors/nested-catch?authed=true\\">Login</a>
            <p>
              There was an expected error at this specific route. The parent still renders
              cause it was fine, but this one threw an expected response.
            </p>
            <p>
              Status:
              <!-- -->401<!-- -->
              <!-- -->Unauthorized
            </p>
            <pre><code>\\"catch data!\\"</code></pre>
          </div>
          "
        `);
      });

      it("renders the route CatchBoundary on fetch requests", async () => {
        await page.goto(`${testServer}/`);
        await Utils.reactIsHydrated(page);

        let responses = Utils.collectDataResponses(
          page,
          "routes/loader-errors/nested-catch"
        );

        await page.click('a[href="/loader-errors/nested-catch"]');
        await page.waitForSelector(
          '[data-test-id="/loader-errors/nested-catch"]'
        );

        expect(responses[0].status()).toBe(401);
        expect(
          await Utils.getHtml(
            page,
            '[data-test-id="/loader-errors/nested-catch"]'
          )
        ).toMatchInlineSnapshot(`
          "<div data-test-id=\\"/loader-errors/nested-catch\\">
            <h2>Nested Catch Boundary</h2>
            <a href=\\"/loader-errors/nested-catch?authed=true\\">Login</a>
            <p>
              There was an expected error at this specific route. The parent still renders
              cause it was fine, but this one threw an expected response.
            </p>
            <p>Status: 401 Unauthorized</p>
            <pre><code>\\"catch data!\\"</code></pre>
          </div>
          "
        `);
      });
    });
  });
});
