import type { LoaderFunction } from "@remix-run/node";

import { auth } from "~/auth.server";

export const loader: LoaderFunction = async ({ request }) => {
  return auth.authenticate("github", request, {
    successRedirect: "/private",
    failureRedirect: "/",
  });
};
