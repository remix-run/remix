import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import * as Utils from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("catchall routes", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("flat", () => {
    it("renders root spat route without javascript", async () => {
      await Utils.disableJavaScript(page);
      let response = await page.goto(`${testServer}/catchall/flat`);
      expect(response!.status()).toBe(200);
      expect(await Utils.getHtml(page, '[data-test-id="/catchall/flat"]'))
        .toMatchInlineSnapshot(`
        "<div data-test-id=\\"/catchall/flat\\">Catchall flat</div>
        "
      `);
    });

    it("renders root spat route with javascript", async () => {
      await page.goto(`${testServer}/`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/catchall/flat"]');
      await page.waitForSelector('[data-test-id="/catchall/flat"]');

      expect(await Utils.getHtml(page, '[data-test-id="/catchall/flat"]'))
        .toMatchInlineSnapshot(`
        "<div data-test-id=\\"/catchall/flat\\">Catchall flat</div>
        "
      `);
    });

    it("renders sub spat route without javascript", async () => {
      await Utils.disableJavaScript(page);
      let response = await page.goto(`${testServer}/catchall/flat/sub`);
      expect(response!.status()).toBe(200);
      expect(await Utils.getHtml(page, '[data-test-id="/catchall/flat"]'))
        .toMatchInlineSnapshot(`
        "<div data-test-id=\\"/catchall/flat\\">Catchall flat</div>
        "
      `);
    });

    it("renders sub spat route with javascript", async () => {
      await page.goto(`${testServer}/`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/catchall/flat/sub"]');
      await page.waitForSelector('[data-test-id="/catchall/flat"]');

      expect(await Utils.getHtml(page, '[data-test-id="/catchall/flat"]'))
        .toMatchInlineSnapshot(`
        "<div data-test-id=\\"/catchall/flat\\">Catchall flat</div>
        "
      `);
    });
  });

  describe("with layout", () => {
    it("index takes precedence over spat route without javascript", async () => {
      await Utils.disableJavaScript(page);
      let response = await page.goto(`${testServer}/catchall-nested`);
      expect(response!.status()).toBe(200);
      expect(
        await Utils.getHtml(page, '[data-test-id="/catchall-nested/index"]')
      ).toMatchInlineSnapshot(`
        "<h1 data-test-id=\\"/catchall-nested/index\\">Index</h1>
        "
      `);
    });

    it("index takes precedence over spat route with javascript", async () => {
      await page.goto(`${testServer}/`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/catchall-nested"]');
      await page.waitForSelector('[data-test-id="/catchall-nested/index"]');

      expect(
        await Utils.getHtml(page, '[data-test-id="/catchall-nested/index"]')
      ).toMatchInlineSnapshot(`
        "<h1 data-test-id=\\"/catchall-nested/index\\">Index</h1>
        "
      `);
    });

    it("renders sub spat route without javascript", async () => {
      await Utils.disableJavaScript(page);
      let response = await page.goto(`${testServer}/catchall-nested/sub`);
      expect(response!.status()).toBe(200);
      expect(
        await Utils.getHtml(page, '[data-test-id="/catchall-nested/splat"]')
      ).toMatchInlineSnapshot(`
        "<div data-test-id=\\"/catchall-nested/splat\\">Catchall Nested</div>
        "
      `);
    });

    it("renders sub spat route with javascript", async () => {
      await page.goto(`${testServer}/`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/catchall-nested/sub"]');
      await page.waitForSelector('[data-test-id="/catchall-nested/splat"]');

      expect(
        await Utils.getHtml(page, '[data-test-id="/catchall-nested/splat"]')
      ).toMatchInlineSnapshot(`
        "<div data-test-id=\\"/catchall-nested/splat\\">Catchall Nested</div>
        "
      `);
    });
  });

  describe("without layout", () => {
    it("renders where index should spat route without javascript", async () => {
      await Utils.disableJavaScript(page);
      let response = await page.goto(`${testServer}/catchall-nested-no-layout`);
      expect(response!.status()).toBe(200);
      expect(
        await Utils.getHtml(page, '[data-test-id="/catchall-nested-no-layout"]')
      ).toMatchInlineSnapshot(`
        "<div data-test-id=\\"/catchall-nested-no-layout\\">Catchall Nested</div>
        "
      `);
    });

    it("renders where index should spat route with javascript", async () => {
      await page.goto(`${testServer}/`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/catchall-nested-no-layout"]');
      await page.waitForSelector('[data-test-id="/catchall-nested-no-layout"]');

      expect(
        await Utils.getHtml(page, '[data-test-id="/catchall-nested-no-layout"]')
      ).toMatchInlineSnapshot(`
        "<div data-test-id=\\"/catchall-nested-no-layout\\">Catchall Nested</div>
        "
      `);
    });

    it("renders sub spat route without javascript", async () => {
      await Utils.disableJavaScript(page);
      let response = await page.goto(
        `${testServer}/catchall-nested-no-layout/sub`
      );
      expect(response!.status()).toBe(200);
      expect(
        await Utils.getHtml(page, '[data-test-id="/catchall-nested-no-layout"]')
      ).toMatchInlineSnapshot(`
        "<div data-test-id=\\"/catchall-nested-no-layout\\">Catchall Nested</div>
        "
      `);
    });

    it("renders sub spat route with javascript", async () => {
      await page.goto(`${testServer}/`);
      await Utils.reactIsHydrated(page);

      await page.click('a[href="/catchall-nested-no-layout/sub"]');
      await page.waitForSelector('[data-test-id="/catchall-nested-no-layout"]');

      expect(
        await Utils.getHtml(page, '[data-test-id="/catchall-nested-no-layout"]')
      ).toMatchInlineSnapshot(`
        "<div data-test-id=\\"/catchall-nested-no-layout\\">Catchall Nested</div>
        "
      `);
    });
  });
});
