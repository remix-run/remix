import type { ActionFunction, LoaderFunction } from "remix";
import { redirect } from "remix";

import { auth } from "~/utils/auth.server";

export const loader: LoaderFunction = async () => redirect("/");

export const action: ActionFunction = ({ request }) => {
  return auth.authenticate("auth0", request);
};
