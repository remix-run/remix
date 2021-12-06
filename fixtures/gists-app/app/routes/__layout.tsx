import type { LoaderFunction } from "remix";
import { useLoaderData } from "remix";
import { Outlet } from "remix";

export let loader: LoaderFunction = () => {
  return { nested: true };
};

export default function LayoutTest() {
  let data = useLoaderData();
  return (
    <div data-test-id="_layout">
      <h1>Layout Test</h1>
      <Outlet context={data} />
    </div>
  );
}
