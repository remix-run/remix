import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { disableJavaScript, getHtml } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("route module meta export", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("route meta export", () => {
    test("meta { title } adds a <title />", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/meta`);
      let title = await getHtml(page, "title");
      expect(title).toEqual(expect.stringMatching(/<title>/s));
    });

    test("meta { description } adds a <meta name='description' />", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/meta`);
      let meta = await getHtml(page, "meta");
      expect(meta).toEqual(
        expect.stringMatching(/<meta\s+name="description"/s)
      );
    });

    test("meta { 'og:*' } adds a <meta property='og:*' />", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/meta`);
      let meta = await getHtml(page, "meta");
      expect(meta).toEqual(expect.stringMatching(/<meta\s+property="og:*/s));
    });

    test("empty meta does not render a tag", async () => {
      await disableJavaScript(page);
      await page.goto(`${testServer}/meta`);
      let meta = await getHtml(page, "meta");
      expect(meta).not.toEqual(
        expect.stringMatching(/<meta\s+property="og:type/s)
      );
    });
  });
});
