import type { ActionFunction, LoaderFunction } from "remix";
import { logout } from "~/utils/session.server";

export let loader: LoaderFunction = async ({ request }) => {
  return logout(request);
};

export let action: ActionFunction = async ({ request }) => {
  return logout(request);
};
