import React from "react";
import { useRouteData } from "@remix-run/react";

export default function NewRoute() {
  let [data] = useRouteData();
  return (
    <div>
      <p>new route</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
