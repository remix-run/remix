import prettier from "prettier";
import type { Page, Response } from "puppeteer";

export function prettyHtml(source: string): string {
  return prettier.format(source, { parser: "html" });
}

export function reactIsHydrated(page: Page) {
  return page.waitForFunction("window.reactIsHydrated === true");
}

export function collectResponses(
  page: Page,
  filter?: (url: URL) => boolean
): Response[] {
  let responses: Response[] = [];

  page.on("response", res => {
    if (!filter || filter(new URL(res.url()))) {
      responses.push(res);
    }
  });

  return responses;
}
