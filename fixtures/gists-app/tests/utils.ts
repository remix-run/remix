import prettier from "prettier";
import type { Page, Request, Response } from "puppeteer";
import cheerio from "cheerio";

export async function getHtml(page: Page, selector?: string): Promise<string> {
  let html = await page.content();
  return prettyHtml(selector ? selectHtml(html, selector) : html);
}

export function selectHtml(source: string, selector: string): string {
  let el = cheerio(selector, source);

  if (!el.length) {
    throw new Error(`No element matches selector "${selector}"`);
  }

  return cheerio.html(el);
}

export function prettyHtml(source: string): string {
  return prettier.format(source, { parser: "html" });
}

interface UrlFilter {
  (url: URL): boolean;
}

export function collectResponses(page: Page, filter?: UrlFilter): Response[] {
  let responses: Response[] = [];

  page.on("response", res => {
    if (!filter || filter(new URL(res.url()))) {
      responses.push(res);
    }
  });

  return responses;
}

export function collectDataResponses(page: Page, routeId?: string) {
  return collectResponses(
    page,
    url =>
      url.pathname.startsWith("/_remix/data") &&
      (routeId === undefined || url.searchParams.get("id") === routeId)
  );
}

export function reactIsHydrated(page: Page) {
  return page.waitForFunction("window.reactIsHydrated === true");
}

export async function disableJavaScript(page: Page) {
  await page.setRequestInterception(true);
  page.on("request", (request: Request) => {
    if (request.resourceType() === "script") request.abort();
    else request.continue();
  });
}
