import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";

import type { AppContext } from "../../../../router.ts";

export async function handler(context: AppContext) {
  return context.render(<Callouts />);
}

function Callouts() {
  return () => (
    <div mix={calloutGridStyles}>
      <Callout tone="brand" title="Start with the route">
        Make the server response correct before adding browser behavior.
      </Callout>
      <Callout tone="neutral" title="Add frames when a region has its own lifecycle">
        Frames keep the embedded UI route-owned while the surrounding guide stays plain Markdown.
      </Callout>
    </div>
  );
}

function Callout(
  handle: Handle<{
    tone: "brand" | "neutral";
    title: string;
    children: RemixNode;
  }>,
) {
  return () => (
    <article mix={[calloutStyles, calloutToneStyles[handle.props.tone]]}>
      <h4 mix={calloutTitleStyles}>{handle.props.title}</h4>
      <p mix={calloutBodyStyles}>{handle.props.children}</p>
    </article>
  );
}

const calloutGridStyles = css({
  display: "grid",
  gap: "var(--rmx-space-md)",
  margin: "var(--rmx-space-xl) 0",
});

const calloutStyles = css({
  padding: "var(--rmx-space-lg)",
  border: "var(--rmx-space-px) solid var(--rmx-color-border-subtle)",
  borderRadius: "var(--rmx-radius-lg)",
  background: "var(--rmx-surface-lvl0)",
});

const calloutToneStyles = {
  brand: css({
    borderColor: "color-mix(in srgb, var(--rmx-color-accent), var(--rmx-color-border-subtle) 60%)",
    boxShadow: "inset var(--rmx-space-xs) 0 0 var(--rmx-color-accent)",
  }),
  neutral: css({
    boxShadow: "inset var(--rmx-space-xs) 0 0 var(--rmx-color-text-muted)",
  }),
};

const calloutTitleStyles = css({
  margin: "0 0 var(--rmx-space-xs)",
  fontSize: "var(--rmx-font-size-md)",
  lineHeight: "var(--rmx-line-height-tight)",
});

const calloutBodyStyles = css({
  margin: "0",
  color: "var(--rmx-color-text-secondary)",
});
