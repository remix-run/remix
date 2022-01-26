import { useMemo } from "react";
import { useMatches } from "remix";

/**
 * This base hook is used in other hooks to quickly search for specific data
 * across all loader data using useMatches.
 * @param {string} key
 * @returns {unknown} The value of the key based on your currently loaded routes.
 */
export default function useLoaderStore(key: string): unknown {
  const matchingRoutes = useMatches();
  const route = useMemo(
    () => matchingRoutes.find((route) => route.data && route.data[key]),
    [matchingRoutes, key]
  );
  if (!route || !route.data || route.data[key] === undefined) {
    return undefined;
  }
  return route.data[key];
}
