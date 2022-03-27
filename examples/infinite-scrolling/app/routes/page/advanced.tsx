import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useVirtual } from "react-virtual";
import type { LoaderFunction, LinksFunction } from "remix";
import {
  json,
  useLoaderData,
  useSearchParams,
  useTransition,
  useBeforeUnload,
} from "remix";

import { countItems, getItemsPaginated } from "~/utils/backend.server";

import stylesUrl from "~/styles/index.css";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

const LIMIT = 200;
const DATA_OVERSCAN = 40;

const getPageLimit = (searchParams: URLSearchParams) => ({
  start: Number(searchParams.get("start") || "0"),
  page: Number(searchParams.get("page") || "0"),
  limit: Number(searchParams.get("limit") || LIMIT.toString()),
});

type LoaderData = {
  items: Array<{ id: string; value: string }>;
  totalItems: number;
};

export const loader: LoaderFunction = async ({ request }) => {
  const { page, limit } = getPageLimit(new URL(request.url).searchParams);
  const data: LoaderData = {
    items: await getItemsPaginated({ page, limit }),
    totalItems: await countItems(),
  };
  return json(data, {
    headers: {
      "Cache-Control": "public, max-age=120",
    },
  });
};

const isServerRender = typeof document === "undefined";
const useSSRLayoutEffect = isServerRender ? () => {} : useLayoutEffect;

function useIsHydrating(queryString: string) {
  const [isHydrating] = useState(
    () => !isServerRender && Boolean(document.querySelector(queryString))
  );
  return isHydrating;
}

export default function Index() {
  const data = useLoaderData<LoaderData>();
  const transition = useTransition();
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrating = useIsHydrating("[data-hydrating-signal]");

  const { limit, start, page } = getPageLimit(searchParams);
  const [initialStart] = useState(() => start);
  const isMountedRef = useRef(false);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtual({
    size: data.totalItems,
    parentRef,
    estimateSize: useCallback(() => 35, []),
    initialRect: { width: 0, height: 800 },
  });

  useBeforeUnload(
    useCallback(() => {
      if (!parentRef.current) return;
      sessionStorage.setItem(
        "infiniteScrollTop-page",
        parentRef.current.scrollTop.toString()
      );
    }, [])
  );

  useSSRLayoutEffect(() => {
    if (!hydrating) return;
    if (!parentRef.current) return;

    const inifiniteScrollTop = sessionStorage.getItem("infiniteScrollTop-page");
    if (!inifiniteScrollTop) return;

    parentRef.current.scrollTop = Number(inifiniteScrollTop);

    return () => {
      sessionStorage.removeItem("infiniteScrollTop");
    };
  }, [initialStart, hydrating]);

  const lowerBoundary = start + DATA_OVERSCAN;
  const upperBoundary = start + limit - DATA_OVERSCAN;
  const middleCount = Math.ceil(limit / 2);

  const [firstVirtualItem] = rowVirtualizer.virtualItems;
  const [lastVirtualItem] = [...rowVirtualizer.virtualItems].reverse();
  if (!firstVirtualItem || !lastVirtualItem) {
    throw new Error("this should never happen");
  }

  let neededStart = start;

  if (firstVirtualItem.index < lowerBoundary) {
    // user is scrolling up. Move the window up
    neededStart =
      Math.floor((firstVirtualItem.index - middleCount) / DATA_OVERSCAN) *
      DATA_OVERSCAN;
  } else if (lastVirtualItem.index > upperBoundary) {
    // user is scrolling down. Move the window down
    neededStart =
      Math.ceil((lastVirtualItem.index - middleCount) / DATA_OVERSCAN) *
      DATA_OVERSCAN;
  }

  // can't go below 0
  if (neededStart < 0) {
    neededStart = 0;
  }

  // can't go above our data
  if (neededStart + limit > data.totalItems) {
    neededStart = data.totalItems - limit;
  }

  useEffect(() => {
    if (!isMountedRef.current) {
      return;
    }
    const newPage = Math.round(neededStart / limit);
    if (newPage !== page) {
      setSearchParams({
        start: String(neededStart),
        page: String(newPage),
        limit: LIMIT.toString(),
      });
    }
  }, [limit, neededStart, page, setSearchParams]);

  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  return (
    <main>
      <h1>Infinite Scrolling Advanced (current page {page})</h1>

      <div
        ref={parentRef}
        data-hydrating-signal
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
            const index = isMountedRef.current
              ? Math.abs(page * limit - virtualRow.index)
              : virtualRow.index;
            const item = data.items[index];

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
