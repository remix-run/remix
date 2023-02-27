import type * as React from "react";
import type { RenderOptions } from "@testing-library/react";
import { render } from "@testing-library/react";

function renderIntoDocument(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "baseElement" | "container">
) {
  return render(ui, {
    baseElement: document.documentElement,
    container: document.body,
    ...options,
  });
}

export { default as userEvent } from "@testing-library/user-event";
export * from "@testing-library/react";
export { renderIntoDocument as render };
