import { useOutletContext } from "remix";

import type { ContextData } from "../__layout";

export default function WithLayout() {
  let outletData = useOutletContext<ContextData>();
  return (
    <div>
      <h1>Page inside layout</h1>
      <pre>{JSON.stringify(outletData, null, 2)}</pre>
    </div>
  );
}
