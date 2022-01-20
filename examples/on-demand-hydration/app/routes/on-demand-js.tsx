import type { LoaderFunction } from "remix";
import { json, useLoaderData } from "remix";

type LoaderData = { withJS: boolean };

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const withJS = url.searchParams.has("js");
  return json<LoaderData>({ withJS });
};

export const handle = {
  hydrate(data: LoaderData) {
    return data.withJS;
  }
};

export default function Screen() {
  const { withJS } = useLoaderData<LoaderData>();

  return (
    <>
      {withJS ? (
        <h1>This route loaded JS, remove `?js` from the URL disable it</h1>
      ) : (
        <h1>This route didn't loaded JS, add `?js` from the URL enable it</h1>
      )}
      <blockquote>Tip: Inspect the Network tab to see it has JS</blockquote>
      <button type="button" onClick={() => alert("It has JS!")}>
        Click me to see JS has loaded
      </button>
      <ul>
        <li>
          <a href="/">Go back</a>
        </li>
        <li>
          <a href="/on-demand-js">Disable JS</a>
        </li>
        <li>
          <a href="/on-demand-js?js">Enable JS</a>
        </li>
      </ul>
    </>
  );
}
