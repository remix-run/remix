import { useOutletContext } from "@remix-run/react";

export default function WithLayout() {
  let outletData = useOutletContext();
  return (
    <div>
      <h1>Page inside layout</h1>
      <pre>{JSON.stringify(outletData, null, 2)}</pre>
    </div>
  );
}
