import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { getHtml } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("the server HTML", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("for the root URL", () => {
    it("is correct", async () => {
      await page.goto(`${testServer}/`);

      // Important: Do NOT wait for React to hydrate
      // because we want to test the server HTML output.

      expect(await getHtml(page)).toMatchSnapshot();
    });
  });
});
