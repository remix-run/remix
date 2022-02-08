import type { LoaderFunction, ActionFunction } from "remix";
import { logout } from "~/session.server";

export const action: ActionFunction = async ({ request }) => {
  return logout(request, { redirect: "/sign-in" });
};

export const loader: LoaderFunction = async ({ request }) => {
  return logout(request, { redirect: "/sign-in" });
};
