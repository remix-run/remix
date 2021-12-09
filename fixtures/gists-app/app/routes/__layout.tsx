import * as React from "react";
import { Outlet } from "remix";

export interface ContextData {
  nested: boolean;
}

export default function LayoutTest() {
  let [contextData] = React.useState<ContextData>({ nested: true });
  return (
    <div data-test-id="_layout">
      <h1>Layout Test</h1>
      <Outlet context={contextData} />
    </div>
  );
}
