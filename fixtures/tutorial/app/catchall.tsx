import type { LoaderFunction } from "remix";
import { useLoaderData } from "remix";

export let loader: LoaderFunction = async ({ params }) => {
  return params["*"];
};

export default function Catchall() {
  let splat = useLoaderData();

  return (
    <div>
      <h1>Heyooo! No 404s here!</h1>
      <p>Here's the splat:</p>
      <pre>{splat}</pre>
    </div>
  );
}
