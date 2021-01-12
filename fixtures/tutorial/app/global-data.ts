import type { Loader } from "@remix-run/data";

export let loader: Loader = async () => {
  return { date: new Date() };
};
