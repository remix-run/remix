import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import * as Utils from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("uncaught exceptions", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("an uncaught action error", () => {
    describe("in an action with an error boundary", () => {
      it("renders the error boundary without JavaScript", async () => {
        await Utils.disableJavaScript(page);
        await page.goto(`${testServer}/action-errors-self-boundary`);

        let [, response2] = await Promise.all([
          page.click("button[type=submit]"),
          page.waitForNavigation()
        ]);

        expect(response2!.status()).toBe(500);

        let html = await Utils.getHtml(
          page,
          '[data-test-id="action-error-boundary"]'
        );
        expect(html).toMatchInlineSnapshot(`
          "<div data-test-id=\\"action-error-boundary\\">
            <h1>Action Error Boundary</h1>
            <pre>I am an action error!</pre>
          </div>
          "
        `);
      });

      it("renders the error boundary with JavaScript", async () => {
        await page.goto(`${testServer}/action-errors-self-boundary`);
        await Utils.reactIsHydrated(page);
        await page.click("button[type=submit]");
        await page.waitForSelector('[data-test-id="action-error-boundary"]');
        let html = await Utils.getHtml(
          page,
          '[data-test-id="action-error-boundary"]'
        );
        expect(html).toMatchInlineSnapshot(`
          "<div data-test-id=\\"action-error-boundary\\">
            <h1>Action Error Boundary</h1>
            <pre>Unexpected Server Error</pre>
          </div>
          "
        `);
      });
    });

    describe("in an action without an error boundary", () => {
      it("renders the parent error boundary without JavaScript", async () => {
        await Utils.disableJavaScript(page);
        await page.goto(`${testServer}/action-errors`);

        let [, response2] = await Promise.all([
          page.click("button[type=submit]"),
          page.waitForNavigation()
        ]);

        expect(response2!.status()).toBe(500);

        let html = await Utils.getHtml(
          page,
          '[data-test-id="app-error-boundary"]'
        );
        expect(html).toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-error-boundary\\">
            <h1>App Error Boundary</h1>
            <pre>I am an action error!</pre>
          </div>
          "
        `);
      });

      it("renders the error boundary with JavaScript", async () => {
        await page.goto(`${testServer}/action-errors`);
        await Utils.reactIsHydrated(page);
        await page.click("button[type=submit]");
        await page.waitForSelector('[data-test-id="app-error-boundary"]');
        let html = await Utils.getHtml(
          page,
          '[data-test-id="app-error-boundary"]'
        );
        expect(html).toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-error-boundary\\">
            <h1>App Error Boundary</h1>
            <pre>Unexpected Server Error</pre>
          </div>
          "
        `);
      });
    });
  });

  describe("an ErrorBoundary with an Outlet", () => {
    it.todo("Does not render anything in the outlet");
  });

  describe("an uncaught render error", () => {
    describe("on a route without an ErrorBoundary", () => {
      it("renders the root ErrorBoundary on document requests", async () => {
        await Utils.disableJavaScript(page);
        let response = await page.goto(`${testServer}/render-errors?throw`);
        expect(response!.status()).toBe(500);
        expect(await Utils.getHtml(page, '[data-test-id="app-error-boundary"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-error-boundary\\">
            <h1>App Error Boundary</h1>
            <pre>I am a render error!</pre>
          </div>
          "
        `);
      });

      it("renders root ErrorBoundary on fetch requests", async () => {
        await page.goto(`${testServer}/`);
        await Utils.reactIsHydrated(page);
        await page.click('a[href="/render-errors?throw"]');
        await page.waitForSelector('[data-test-id="app-error-boundary"]');
        expect(await Utils.getHtml(page, '[data-test-id="app-error-boundary"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-error-boundary\\">
            <h1>App Error Boundary</h1>
            <pre>I am a render error!</pre>
          </div>
          "
        `);
      });
    });

    describe("on a route with an ErrorBoundary", () => {
      it("renders the route ErrorBoundary on document requests", async () => {
        await Utils.disableJavaScript(page);
        let response = await page.goto(`${testServer}/render-errors/nested`);
        expect(response!.status()).toBe(500);
        expect(await Utils.getHtml(page, '[data-test-id="/render-errors"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"/render-errors\\">
            <h1>Render Errors</h1>
            <p>
              This is the parent route, it rendered just fine. Any errors in the children
              will be handled there, but this layout renders normally.
            </p>
            <div data-test-id=\\"/render-errors/nested\\">
              <h2>Nested Error Boundary</h2>
              <p>
                There was an error at this specific route. The parent still renders cause
                it was fine, but this one blew up.
              </p>
              <pre>I am a render error!</pre>
            </div>
          </div>
          "
        `);
      });

      it("renders the route ErrorBoundary on fetch requests", async () => {
        await page.goto(`${testServer}/`);
        await Utils.reactIsHydrated(page);
        await page.click('a[href="/render-errors/nested"]');
        await page.waitForSelector('[data-test-id="/render-errors/nested"]');
        expect(await Utils.getHtml(page, '[data-test-id="/render-errors"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"/render-errors\\">
            <h1>Render Errors</h1>
            <p>
              This is the parent route, it rendered just fine. Any errors in the children
              will be handled there, but this layout renders normally.
            </p>
            <div data-test-id=\\"/render-errors/nested\\">
              <h2>Nested Error Boundary</h2>
              <p>
                There was an error at this specific route. The parent still renders cause
                it was fine, but this one blew up.
              </p>
              <pre>I am a render error!</pre>
            </div>
          </div>
          "
        `);
      });
    });
  });

  describe("an uncaught loader error", () => {
    describe("on a route without an ErrorBoundary", () => {
      it("renders the root ErrorBoundary on document requests", async () => {
        await Utils.disableJavaScript(page);
        let response = await page.goto(`${testServer}/loader-errors?throw`);
        expect(response!.status()).toBe(500);
        expect(await Utils.getHtml(page, '[data-test-id="app-error-boundary"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-error-boundary\\">
            <h1>App Error Boundary</h1>
            <pre>I am a loader error!</pre>
          </div>
          "
        `);
      });

      it("renders root ErrorBoundary on fetch requests", async () => {
        await page.goto(`${testServer}/`);
        await Utils.reactIsHydrated(page);

        let responses = Utils.collectDataResponses(
          page,
          "routes/loader-errors"
        );

        await page.click('a[href="/loader-errors?throw"]');
        await page.waitForSelector('[data-test-id="app-error-boundary"]');

        expect(responses[0].status()).toBe(500);
        expect(await Utils.getHtml(page, '[data-test-id="app-error-boundary"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"app-error-boundary\\">
            <h1>App Error Boundary</h1>
            <pre>Unexpected Server Error</pre>
          </div>
          "
        `);
      });
    });

    describe("on a route with an ErrorBoundary", () => {
      it("renders the route ErrorBoundary on document requests", async () => {
        await Utils.disableJavaScript(page);
        let response = await page.goto(`${testServer}/loader-errors/nested`);
        expect(response!.status()).toBe(500);
        expect(await Utils.getHtml(page, '[data-test-id="/loader-errors"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"/loader-errors\\">
            <h1>Loader Errors</h1>
            <p>
              This is the parent route, it rendered just fine. Any errors in the children
              will be handled there, but this layout renders normally.
            </p>
            <div data-test-id=\\"/loader-errors/nested\\">
              <h2>Nested Error Boundary</h2>
              <p>
                There was an error at this specific route. The parent still renders cause
                it was fine, but this one blew up.
              </p>
              <pre>I am a loader error!</pre>
            </div>
          </div>
          "
        `);
      });

      it("renders the route ErrorBoundary on fetch requests", async () => {
        await page.goto(`${testServer}/`);
        await Utils.reactIsHydrated(page);

        let responses = Utils.collectDataResponses(
          page,
          "routes/loader-errors/nested"
        );

        await page.click('a[href="/loader-errors/nested"]');
        await page.waitForSelector('[data-test-id="/loader-errors/nested"]');

        expect(responses[0].status()).toBe(500);
        expect(await Utils.getHtml(page, '[data-test-id="/loader-errors"]'))
          .toMatchInlineSnapshot(`
          "<div data-test-id=\\"/loader-errors\\">
            <h1>Loader Errors</h1>
            <p>
              This is the parent route, it rendered just fine. Any errors in the children
              will be handled there, but this layout renders normally.
            </p>
            <div data-test-id=\\"/loader-errors/nested\\">
              <h2>Nested Error Boundary</h2>
              <p>
                There was an error at this specific route. The parent still renders cause
                it was fine, but this one blew up.
              </p>
              <pre>Unexpected Server Error</pre>
            </div>
          </div>
          "
        `);
      });
    });
  });
});
