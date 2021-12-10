import { Form, Link, useLoaderData, useTransition } from "remix";
import type { MetaFunction, LinksFunction } from "remix";

import stylesUrl from "../styles/index.css";

export let meta: MetaFunction = () => {
  return {
    title: "Remix: Search a TV show",
    description: "Search a TV show"
  };
};

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export let loader = async ({ request }) => {
  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search");

  if (!searchTerm)
    return {
      status: "emptySearch",
      searchTerm,
      items: []
    };

  const result = await fetch(
    `https://api.tvmaze.com/search/shows?q=${searchTerm}`
  );
  const data = await result.json();

  if (!data || !data.length)
    return {
      status: "noResults",
      searchTerm,
      items: []
    };

  return {
    status: "resultsFound",
    searchTerm,
    items: data
      .filter(item => item.show.image)
      .map(item => ({
        id: item.id,
        name: item.show.name,
        image: item.show.image.medium,
        url: item.show.url
      }))
  };
};

export default function Index() {
  const data = useLoaderData();
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
