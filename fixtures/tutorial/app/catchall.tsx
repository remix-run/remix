import type { LoaderFunction } from "@remix-run/express";
import { useRouteData } from "@remix-run/react";

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
