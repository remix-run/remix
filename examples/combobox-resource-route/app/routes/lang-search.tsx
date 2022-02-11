import type { LoaderFunction } from "remix";
import { json } from "remix";
import { searchLangs } from "~/models/langs";

/**
 * This route is called via `useFetcher` from the Combobox input. It returns a
 * set of languages as the user types. It's called a Resource Route because it
 * doesn't export a component.  You might think of it as an "API Route".
 */
export const loader: LoaderFunction = async ({ request }) => {
  // First get what the user is searching for by creating a URL:
  // https://developer.mozilla.org/en-US/docs/Web/API/URL
  // https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  // Search the languages, you can go look at `app/langs.ts` to see what it's
  // doing, but this part will obviously be different for your app.
  const langs = (await searchLangs(query || "")).slice(0, 20);

  return json(langs, {
    // Add a little bit of caching so when the user backspaces a value in the
    // Combobox, the browser has a local copy of the data and doesn't make a
    // request to the server for it. No need to send a client side data fetching
    // library that caches results in memory, the browser has this ability
    // built-in.
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
    headers: { "Cache-Control": "max-age=60" }
  });
};

/**
 * You shouldn't have to export this, we have a bug.
 * TODO: add github issue link (or just fix it)
 */
export default function Bug() {
  return null;
}
