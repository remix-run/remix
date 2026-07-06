import { readFile } from "node:fs/promises";

import { codeToHtml } from "shiki";
import { clientEntry, css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";

import type { AppContext } from "../../../router.ts";
import { shikiThemes } from "../markdown/code-blocks.ts";

type DemoComponent = (handle: Handle) => () => RemixNode;

export type DemoProps = {
  sourceHtml: string;
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
// highlighted source code.
export function Demo(handle: Handle<DemoProps>) {
  return () => (
    <section data-demo-frame mix={frameStyles}>
      <div data-demo-preview mix={previewStyles}>
        {handle.props.children}
      </div>
      <div
        data-demo-source
        mix={sourceCodeStyles}
        innerHTML={handle.props.sourceHtml}
      />
    </section>
  );
}

// Builds a frame handler for a "demo with code": hydrates `component`, highlights
// the source at `demoModuleUrl`, and renders both in the shared <Demo> shell.
//
// `component` must be a named export of the `.demo.tsx` module whose name
// matches the function name, so `clientEntry` can resolve the export via
// `component.name`.
export function demoWithCode(
  demoModuleUrl: URL,
  component: DemoComponent,
): (context: AppContext) => Promise<Response> {
  return async function handler(context) {
    let sourceHtml = await loadDemoSource(demoModuleUrl);
    let DemoComponent = clientEntry(demoModuleUrl.href, component);

    return context.render(
      <Demo sourceHtml={sourceHtml}>
        <DemoComponent />
      </Demo>,
    );
  };
}

const frameStyles = css({
  overflow: "hidden",
  margin: "var(--rmx-space-xl) 0",
  border: "var(--rmx-space-px) solid var(--rmx-color-border-subtle)",
  borderRadius: "var(--rmx-radius-lg)",
  background: "var(--rmx-surface-lvl0)",
});

const previewStyles = css({
  position: "relative",
  isolation: "isolate",
  contain: "layout paint",
  transform: "translateZ(0)",
  display: "grid",
  maxHeight: "36rem",
  minHeight: "12rem",
  overflow: "auto",
  overscrollBehavior: "contain",
  padding: "calc(var(--rmx-space-xl) * 2) var(--rmx-space-xl)",
  placeItems: "center",
  background: "var(--rmx-surface-lvl0)",
});

const sourceCodeStyles = css({
  maxHeight: "32rem",
  overflow: "auto",
  overscrollBehavior: "contain",
  borderTop: "var(--rmx-space-px) solid var(--rmx-color-border-subtle)",
  background: "var(--rmx-surface-lvl2)",
  "& pre": {
    margin: "0",
    padding: "var(--rmx-space-xl)",
    border: "0",
    borderRadius: "0",
  },
});
