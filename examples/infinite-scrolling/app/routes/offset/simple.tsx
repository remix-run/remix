import * as React from "react";
import type { LoaderFunction, LinksFunction } from "remix";
import { json, useLoaderData, useTransition, useFetcher } from "remix";
import { useVirtual } from "react-virtual";

import { countItems, getItems } from "~/utils/backend.server";

import stylesUrl from "~/styles/index.css";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

const LIMIT = 200;
const DATA_OVERSCAN = 40;

const getStartLimit = (searchParams: URLSearchParams) => ({
  start: Number(searchParams.get("start") || "0"),
  limit: Number(searchParams.get("limit") || LIMIT.toString()),
});

type LoaderData = {
  items: Array<{ id: string; value: string }>;
  totalItems: number;
};

export const loader: LoaderFunction = async ({ request }) => {
  const { start, limit } = getStartLimit(new URL(request.url).searchParams);
  const data: LoaderData = {
    items: await getItems({ start, limit }),
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

  const transition = useTransition();
  const fetcher = useFetcher();

  const startRef = React.useRef(0);
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtual({
    size: data.totalItems,
    parentRef,
    estimateSize: React.useCallback(() => 35, []),
    initialRect: { width: 0, height: 800 },
  });

  const [lastVirtualItem] = [...rowVirtualizer.virtualItems].reverse();
  if (!lastVirtualItem) {
    throw new Error("this should never happen");
  }

  let newStart = startRef.current;
  const upperBoundary = startRef.current + LIMIT - DATA_OVERSCAN;

  if (lastVirtualItem.index > upperBoundary) {
    // user is scrolling down. Move the window down
    newStart = startRef.current + LIMIT;
  }

  React.useEffect(() => {
    if (newStart === startRef.current) return;

    const qs = new URLSearchParams([
      ["start", String(newStart)],
      ["limit", String(LIMIT)],
    ]);
    fetcher.load(`/offset/simple?${qs}`);
    startRef.current = newStart;
  }, [newStart, fetcher]);

  React.useEffect(() => {
    if (fetcher.data) {
      setItems((prevItems) => [...prevItems, ...fetcher.data.items]);
    }
  }, [fetcher.data]);

  return (
    <main>
      <h1>Simple Infinite Scrolling (offset={startRef.current})</h1>

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
            const item = items[virtualRow.index];

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
                <span>{virtualRow.index}</span>
                <span>
                  {item
                    ? item.value
                    : transition.state === "loading"
                    ? "Loading more..."
                    : "Nothing to see here..."}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
