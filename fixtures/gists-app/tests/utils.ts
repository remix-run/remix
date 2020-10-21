import prettier from "prettier";
import type { Page, Response } from "puppeteer";

export function prettyHtml(source: string): string {
  return prettier.format(source, { parser: "html" });
}

export function reactIsHydrated(page: Page) {
  return page.waitForFunction("window.reactIsHydrated === true");
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
