import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import type { TestContext } from "remix/test";

import { createAssetServer } from "../../../assets.ts";
import { createDocsRouter } from "../../../router.ts";
import { handler as basicCounterHandler } from "./05-interactivity/basic-counter.tsx";
import { handler as counterHandler } from "./16-markdown-style-demo/counter.tsx";
import { getMarkdownFallback } from "./markdown-fallback.ts";

describe("demoWithCode()", () => {
  it("renders the hydrated demo beside its highlighted source", async (t) => {
    let html = await fetchExample(t, "/examples/16-markdown-style-demo/counter/");

    assert.match(html, /data-demo-frame="true"/);
    assert.match(html, /class="shiki/);
    assert.match(html, /"exportName":"Counter"/);
  });

  it("uses the demo module as the markdown fallback", () => {
    let fallback = getMarkdownFallback(counterHandler);

    assert.ok(fallback);
    assert.match(
      fallback.sourceUrl.pathname,
      /\/16-markdown-style-demo\/public\/counter\.demo\.dev\.tsx$/,
    );
  });
});

describe("demoPreview()", () => {
  it("renders only the hydrated demo", async (t) => {
    let html = await fetchExample(t, "/examples/05-interactivity/basic-counter/");

    assert.match(html, /data-demo-frame="true"/);
    assert.doesNotMatch(html, /class="shiki/);
    assert.match(html, /"exportName":"BasicCounter"/);
  });

  it("declares no markdown fallback", () => {
    assert.equal(getMarkdownFallback(basicCounterHandler), undefined);
  });
});

async function fetchExample(t: TestContext, pathname: string) {
  let assetServer = createAssetServer();
  t.after(() => assetServer.close());
  let router = createDocsRouter({ assetServer });
  let response = await router.fetch(new Request(`http://localhost${pathname}`));

  assert.equal(response.status, 200);
  return response.text();
}
