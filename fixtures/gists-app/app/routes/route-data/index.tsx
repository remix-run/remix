import type { LoaderFunction } from "remix";
import { useRouteData } from "remix";

export let loader: LoaderFunction = async () => {
  return { title: "Child Route Data" };
};

export default function IndexRouteData() {
  let data = useRouteData<{ title: string }>("routes/route-data");
  return (
    <div>
      <h2 data-test-id="child-title">
        {data?.title || "No parent route found"}
      </h2>
    </div>
  );
}
