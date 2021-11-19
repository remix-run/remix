import type { LoaderFunction } from "remix";
import { logout } from "~/utils/session.server";

export let loader: LoaderFunction = async ({ request }) => {
  return logout(request);
};
