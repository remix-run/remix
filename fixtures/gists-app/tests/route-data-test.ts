import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";
import { disableJavaScript, getHtml, reactIsHydrated } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("route data", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("the parent should render the child title", () => {
    it("with javascript enabled", async () => {
      await page.goto(`${testServer}/route-data`);
      await reactIsHydrated(page);

      expect(await getHtml(page, '[data-test-id="parent-title"]'))
        .toMatchInlineSnapshot(`
        "<h1 data-test-id=\\"parent-title\\">Child Route Data</h1>
        "
      `);
    });

    it("with javascript disabled", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/route-data`);

      expect(await getHtml(page, '[data-test-id="parent-title"]'))
        .toMatchInlineSnapshot(`
        "<h1 data-test-id=\\"parent-title\\">Child Route Data</h1>
        "
      `);
    });
  });

  describe("the parent should render fallback if route is not rendered", () => {
    it("with javascript enabled", async () => {
      await page.goto(`${testServer}/route-data`);
      await reactIsHydrated(page);

      expect(await getHtml(page, '[data-test-id="new-title"]'))
        .toMatchInlineSnapshot(`
        "<p data-test-id=\\"new-title\\">The route /new was not found</p>
        "
      `);
    });

    it("with javascript disabled", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/route-data`);

      expect(await getHtml(page, '[data-test-id="new-title"]'))
        .toMatchInlineSnapshot(`
        "<p data-test-id=\\"new-title\\">The route /new was not found</p>
        "
      `);
    });
  });

  describe("the child should render the parent title", () => {
    it("with javascript enabled", async () => {
      await page.goto(`${testServer}/route-data`);
      await reactIsHydrated(page);

      expect(await getHtml(page, '[data-test-id="child-title"]'))
        .toMatchInlineSnapshot(`
        "<h2 data-test-id=\\"child-title\\">Parent Route Data</h2>
        "
      `);
    });

    it("with javascript disabled", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/route-data`);

      expect(await getHtml(page, '[data-test-id="child-title"]'))
        .toMatchInlineSnapshot(`
        "<h2 data-test-id=\\"child-title\\">Parent Route Data</h2>
        "
      `);
    });
  });
});
