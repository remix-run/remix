import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";

import { collectResponses } from "./utils";

const testPort = 3000;
const testServer = `http://localhost:${testPort}`;

describe("route headers", () => {
  let browser: Browser;
  let page: Page;
  beforeEach(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterEach(() => browser.close());

  describe("from a JavaScript route", () => {
    it("are correct", async () => {
      let responses = collectResponses(page, url => url.pathname === "/gists");

      await page.goto(`${testServer}/gists`);

      expect(responses).toHaveLength(1);
      expect(responses[0].headers()).toMatchInlineSnapshot(
        {
          date: expect.any(String)
        },
        `
        Object {
          "cache-control": "public, max-age=60",
          "connection": "keep-alive",
          "content-length": "2666",
          "content-type": "text/html; charset=utf-8",
          "date": Any<String>,
          "etag": "W/\\"a6a-C6qk9a8fmQwKmB/mw2MylovlKPA\\"",
          "x-powered-by": "Express",
        }
      `
      );
    });
  });

  describe("from a JavaScript child route", () => {
    it("overrides the parent header of the same name", async () => {
      let responses = collectResponses(
        page,
        url => url.pathname === "/gists/mjackson"
      );

      await page.goto(`${testServer}/gists/mjackson`);

      expect(responses).toHaveLength(1);
      expect(responses[0].headers()).toMatchInlineSnapshot(
        {
          date: expect.any(String)
        },
        `
        Object {
          "cache-control": "public, max-age=300",
          "connection": "keep-alive",
          "content-length": "2773",
          "content-type": "text/html; charset=utf-8",
          "date": Any<String>,
          "etag": "W/\\"ad5-3gHzfY/rXTTyKfeubbzfkM5DFIM\\"",
          "x-powered-by": "Express",
        }
      `
      );
    });
  });

  describe("from an MDX route", () => {
    it("are correct", async () => {
      let responses = collectResponses(
        page,
        url => url.pathname === "/page/one"
      );

      await page.goto(`${testServer}/page/one`);

      expect(responses).toHaveLength(1);
      expect(responses[0].headers()).toMatchInlineSnapshot(
        {
          date: expect.any(String)
        },
        `
        Object {
          "cache-control": "max-age=0, public, must-revalidate",
          "connection": "keep-alive",
          "content-length": "1489",
          "content-type": "text/html; charset=utf-8",
          "date": Any<String>,
          "etag": "W/\\"5d1-8/RmPlS18LdNhYE7xBuKoT/Mmds\\"",
          "x-powered-by": "Express",
        }
      `
      );
    });
  });
});
