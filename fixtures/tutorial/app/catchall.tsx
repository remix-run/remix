import { useRouteData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/data";

export let loader: LoaderFunction = ({ params }) => {
  return params["*"];
};

export default function Catchall() {
  let splat = useRouteData();

  return (
    <div>
      <h1>Heyooo! No 404s here!</h1>
      <p>Here's the splat:</p>
      <pre>{splat}</pre>
    </div>
  );
}
