import type { LoaderFunction } from "remix";
import { useFetcher, useLoaderData } from "remix";
import { useEffect, useState } from "react";
import InfiniteScroll from "react-infinite-scroller";

type Joke = {
  id: number;
  joke: string;
};

type LoaderData = {
  results: Joke[];
  total_pages: number;
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");

  const res = await fetch(`https://icanhazdadjoke.com/search?page=${page}`, {
    headers: { Accept: "application/json" },
  });

  return res.json();
};

export default function Index() {
  const { results, total_pages } = useLoaderData<LoaderData>();

  const fetcher = useFetcher();

  const [page, setPage] = useState(1);
  const [jokes, setJokes] = useState(results);
  const [canLoadMore, setCanLoadMore] = useState(true);

  const handleLoadMore = () => {
    if (fetcher.state === "idle" && canLoadMore) {
      setCanLoadMore(false);
      fetcher.load(`/?page=${page + 1}`);
    }
  };

  useEffect(() => {
    if (fetcher.data && fetcher.data.results.length > 0) {
      setJokes((prev) => [...prev, ...fetcher.data.results]);
      setPage((prev) => prev + 1);
      setCanLoadMore(true);
    }
  }, [fetcher.data]);

  return (
    <main>
      <h1
        style={{
          top: 0,
          position: "sticky",
          background: "white",
          padding: "1rem",
        }}
      >
        Infinite Scrolling Jokes (pages loaded {page}/{total_pages})
      </h1>

      <ol>
        <InfiniteScroll
          pageStart={0}
          loadMore={handleLoadMore}
          hasMore={page < total_pages}
          loader={<div key={0}>loading...</div>}
        >
          {jokes.map(({ id, joke }) => (
            <li key={id}>{joke}</li>
          ))}
        </InfiniteScroll>
      </ol>
    </main>
  );
}
