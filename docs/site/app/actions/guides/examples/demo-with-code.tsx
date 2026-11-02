import { readFile } from "node:fs/promises";

import { codeToHtml } from "shiki";
import { clientEntry, css } from "remix/component";
import type { Handle, RemixNode } from "remix/component";
import { shikiThemes } from "remix-docs-shared/markdown/code-blocks";
import { DocsDemo } from "remix-docs-shared/ui/demo";

import type { AppContext } from "../../../router.ts";
import { setMarkdownFallback } from "./markdown-fallback.ts";

type DemoComponent = (handle: Handle) => () => RemixNode;

export type DemoProps = {
  sourceHtml?: string;
  children: RemixNode;
};

// Reads a `.demo.tsx` module from disk and highlights it for display beside
// the live preview. Highlighting is async (shiki), so this runs in the frame handler
// and the resulting HTML is passed to <Demo> as `sourceHtml`.
export async function loadDemoSource(moduleUrl: URL): Promise<string> {
  let source = await readFile(moduleUrl, "utf8");
  return codeToHtml(source, {
    lang: "tsx",
    themes: shikiThemes,
  });
}

// Renders a demo: the live, hydrated component in a preview pane above its own
// highlighted source code, which starts collapsed.
export function Demo(handle: Handle<DemoProps>) {
  return () => (
    <div data-demo-frame mix={frameStyles}>
      <DocsDemo sourceHtml={handle.props.sourceHtml}>{handle.props.children}</DocsDemo>
    </div>
  );
}

// Builds a frame handler for a "demo with code": hydrates `component`, highlights
// the source at `demoModuleUrl`, and renders both in the shared <Demo> shell. In
// markdown, the frame is replaced with that same source.
//
// `component` must be a named export of the `.demo.tsx` module whose name
// matches the function name, so `clientEntry` can resolve the export via
// `component.name`.
export function demoWithCode(
  demoModuleUrl: URL,
  component: DemoComponent,
): (context: AppContext) => Promise<Response> {
  async function handler(context: AppContext) {
    let sourceHtml = await loadDemoSource(demoModuleUrl);
    let DemoComponent = clientEntry(demoModuleUrl.href, component);

    return context.render(
      <Demo sourceHtml={sourceHtml}>
        <DemoComponent />
      </Demo>,
    );
  }

  setMarkdownFallback(handler, { sourceUrl: demoModuleUrl });
  return handler;
}

// Renders only the live preview when the chapter already includes the source. It
// declares no markdown fallback, so the markdown version strips the frame.
export function demoPreview(
  demoModuleUrl: URL,
  component: DemoComponent,
): (context: AppContext) => Response {
  function handler(context: AppContext) {
    let DemoComponent = clientEntry(demoModuleUrl.href, component);

    return context.render(
      <Demo>
        <DemoComponent />
      </Demo>,
    );
  }

  return handler;
}

const frameStyles = css({
  margin: "var(--rmx-space-xl) 0",
  // Some guide demos are full mini apps, so keep them scrollable instead of
  // stretching the chapter.
  "& .docs-demo-preview": {
    contain: "layout paint",
    transform: "translateZ(0)",
    maxHeight: "36rem",
    overflow: "auto",
    overscrollBehavior: "contain",
  },
});
