import type { LoaderFunction } from "remix";
import { useLoaderData } from "remix";
import { Outlet } from "remix";

export interface RouteData {
  nested: boolean;
}

export let loader: LoaderFunction = () => {
  let data: RouteData = { nested: true };
  return data;
};

export default function LayoutTest() {
  let data = useLoaderData<RouteData>();
  return (
    <div data-test-id="_layout">
      <h1>Layout Test</h1>
      <Outlet context={data} />
    </div>
  );
}
