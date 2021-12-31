import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { disableJavaScript, getHtml, reactIsHydrated } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("ClientOnly and useIsHydrated", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("the h1 should change if JS loaded or not", () => {
    it("with javascript enabled", async () => {
      await page.goto(`${testServer}/client-only`);
      await reactIsHydrated(page);

      expect(await getHtml(page, '[data-test-id="client-only-title"]'))
        .toMatchInlineSnapshot(`
        "<h1 data-test-id=\\"client-only-title\\">Client Side</h1>
        "
      `);
    });

    it("with javascript disabled", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/client-only`);

      expect(await getHtml(page, '[data-test-id="server-only-title"]'))
        .toMatchInlineSnapshot(`
        "<h1 data-test-id=\\"server-only-title\\">Server-Side</h1>
        "
      `);
    });
  });

  describe("the button should be enabled only if JS loaded", () => {
    it("with javascript enabled", async () => {
      await page.goto(`${testServer}/client-only`);
      await reactIsHydrated(page);

      expect(await getHtml(page, '[data-test-id="client-only-button"]'))
        .toMatchInlineSnapshot(`
        "<button type=\\"button\\" data-test-id=\\"client-only-button\\">
          I only work client side
        </button>
        "
      `);
    });

    it("with javascript disabled", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/client-only`);

      expect(await getHtml(page, '[data-test-id="client-only-button"]'))
        .toMatchInlineSnapshot(`
        "<button type=\\"button\\" disabled=\\"\\" data-test-id=\\"client-only-button\\">
          I only work client side
        </button>
        "
      `);
    });
  });
});
