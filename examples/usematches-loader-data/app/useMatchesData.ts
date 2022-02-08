import { useMemo } from "react";
import { useMatches } from "remix";

/**
 * This base hook is used in other hooks to quickly search for specific data
 * across all loader data using useMatches.
 * @param {string} id The route id
 * @returns {JSON} The value of the key based on your currently loaded routes.
 */
export default function useMatchesData(id: string): Record<string, unknown> {
  const matchingRoutes = useMatches();
  const route = useMemo(() => matchingRoutes.find((route) => route.id === id), [
    matchingRoutes,
    id
  ]);
  return route?.data || {};
}
