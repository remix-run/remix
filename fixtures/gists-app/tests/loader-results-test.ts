import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { getHtml } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("loader results", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("when a loader returns a redirect", () => {
    it("sends a redirect", async () => {
      let res = await page.goto(`${testServer}/gists/mjijackson`);
      let chain = res.request().redirectChain();
      expect(chain.length).toEqual(1);
      expect(chain[0].response().status()).toEqual(302);
      expect(chain[0].response().headers().location).toEqual("/gists/mjackson");
    });
  });

  describe("when a loader returns not found", () => {
    it("sends a not found page", async () => {
      let res = await page.goto(`${testServer}/gists/_why`);
      expect(res.status()).toEqual(404);
      expect(await getHtml(page, "[data-test-id=content]")).toMatchSnapshot();
    });
  });

  describe.skip("when the loader has an error", () => {
    it("sends a server error page", async () => {
      let res = await page.goto(`${testServer}/gists/DANGER`);
      expect(res.status()).toEqual(500);
      expect(await getHtml(page, "[data-test-id=content]")).toMatchSnapshot();
    });
  });
});
