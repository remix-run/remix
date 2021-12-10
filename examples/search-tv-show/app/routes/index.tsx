import { Form, json, useLoaderData, useTransition } from "remix";
import type { MetaFunction, LinksFunction, LoaderFunction } from "remix";
import stylesUrl from "../styles/index.css";

export const meta: MetaFunction = () => {
  return {
    title: "Remix: Search a TV show",
    description: "Search a TV show"
  };
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

type ShowResult = {
  id: string;
  show: { name: string; url: string; image?: { medium: string } };
};

type LoaderData = {
  status: "resultsFound" | "noResults" | "emptySearch";
  searchTerm: string;
  items: Array<{ id: string; name: string; image: string; url: string }>;
};

function typedBoolean<T>(
  value: T
): value is Exclude<T, "" | 0 | false | null | undefined> {
  return Boolean(value);
}

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search");

  if (!searchTerm) {
    const data: LoaderData = {
      status: "emptySearch",
      searchTerm: searchTerm || "",
      items: []
    };
    return json(data);
  }

  const result = await fetch(
    `https://api.tvmaze.com/search/shows?q=${searchTerm}`
  );
  const showResults = (await result.json()) as undefined | Array<ShowResult>;

  if (!showResults || !showResults.length) {
    const data: LoaderData = {
      status: "noResults",
      searchTerm,
      items: []
    };
    return json(data);
  }

  const data: LoaderData = {
    status: "resultsFound",
    searchTerm,
    items: showResults
      .map(item =>
        item.show.image
          ? {
              id: item.id,
              name: item.show.name,
              image: item.show.image.medium,
              url: item.show.url
            }
          : null
      )
      .filter(typedBoolean)
  };

  return json(data, {
    headers: {
      "Cache-Control": "max-age=60, stale-while-revalidate=60"
    }
  });
};

export default function Index() {
  const data = useLoaderData<LoaderData>();
  const transition = useTransition();

  return (
    <div className="container">
      <Form method="get" className="search-form">
        <input
          defaultValue={data.searchTerm}
          placeholder="Search a TV show..."
          autoComplete="off"
          name="search"
          type="search"
        />
        <button type="submit">Search</button>
      </Form>
      {transition.state === "submitting" ? (
        <div className="results">
          {[...Array(8).keys()].map(() => (
            <div className="placeholder" />
          ))}
        </div>
      ) : (
        <>
          {data.status === "emptySearch" && (
            <p className="info">
              Start searching...{" "}
              <span role="img" aria-label="point up emoji">
                ☝️
              </span>
            </p>
          )}

          {data.status === "noResults" && (
            <p className="info">
              Ooops, no results{" "}
              <span role="img" aria-label="crying emoji">
                😢
              </span>
            </p>
          )}

          {data.status === "resultsFound" && (
            <div className="results">
              {data.items.map(item => (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="placeholder"
                  key={item.id}
                >
                  <img src={item.image} alt={item.name} />
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
