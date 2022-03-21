import type { LoaderFunction } from "remix";
import { Outlet, useRouteData } from "remix";

export let loader: LoaderFunction = async () => {
  return { title: "Parent Route Data" };
};

export default function ParentRouteData() {
  let indexData = useRouteData<{ title: string }>("routes/route-data/index");
  let newData = useRouteData<{ title: string }>("routes/route-data/new");
  return (
    <div>
      <h1 data-test-id="parent-title">
        {indexData?.title || "No child route"}
      </h1>
      <p data-test-id="new-title">
        {newData?.title || "The route /new was not found"}
      </p>
      <Outlet />
    </div>
  );
}
