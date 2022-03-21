import * as React from "react";
import type { LoaderFunction, LinksFunction } from "remix";
import { json, useLoaderData, useFetcher } from "remix";
import { useVirtual } from "react-virtual";

import { countItems, getItemsPaginated } from "~/utils/backend.server";

import stylesUrl from "~/styles/index.css";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

const LIMIT = 200;

const getPage = (searchParams: URLSearchParams) => ({
  page: Number(searchParams.get("page") || "0"),
});

type LoaderData = {
  items: Array<{ id: string; value: string }>;
  totalItems: number;
};

export const loader: LoaderFunction = async ({ request }) => {
  const { page } = getPage(new URL(request.url).searchParams);
  const data: LoaderData = {
    items: await getItemsPaginated({ page, limit: LIMIT }),
    totalItems: await countItems(),
  };
  return json(data, {
    headers: {
      "Cache-Control": "public, max-age=120",
    },
  });
};

export default function Index() {
  const data = useLoaderData<LoaderData>();
  const [items, setItems] = React.useState(data.items);

  const fetcher = useFetcher();

  const page = React.useRef(0);
  const parentRef = React.useRef<HTMLDivElement>(null);

  const canFetchMore = items.length < data.totalItems;

  const rowVirtualizer = useVirtual({
    size: data.totalItems,
    parentRef,
    initialRect: { width: 0, height: 800 },
    estimateSize: React.useCallback(() => 35, []),
  });

  React.useEffect(() => {
    const [lastItem] = [...rowVirtualizer.virtualItems].reverse();

    if (!lastItem) {
      return;
    }

    if (
      lastItem.index > items.length - 1 &&
      canFetchMore &&
      fetcher.state === "idle" &&
      page.current < items.length / LIMIT
    ) {
      page.current += 1;
      fetcher.load(`/page/alternative?page=${page.current}`);
    }
  }, [canFetchMore, fetcher, items.length, page, rowVirtualizer.virtualItems]);

  React.useEffect(() => {
    if (fetcher.data) {
      setItems((prevItems) => [...prevItems, ...fetcher.data.items]);
    }
  }, [fetcher.data]);

  return (
    <main>
      <h1>
        Infinite Scrolling (pages loaded {page.current + 1}/
        {data.totalItems / LIMIT})
      </h1>

      <div
        ref={parentRef}
        className="List"
        style={{
          height: `800px`,
          width: `100%`,
          overflow: "auto",
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.totalSize}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.virtualItems.map((virtualRow) => {
            const { index } = virtualRow;
            const isLoaderRow = index > items.length - 1;
            const item = items[index];

            return (
              <div
                key={virtualRow.key}
                className={`list-item ${
                  virtualRow.index % 2 ? "list-item--odd" : "list-item--even"
                }`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isLoaderRow ? (
                  canFetchMore ? (
                    "Loading more..."
                  ) : (
                    "Nothing more to load"
                  )
                ) : (
                  <>
                    <span>{index}</span>
                    <span>{item.value}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
