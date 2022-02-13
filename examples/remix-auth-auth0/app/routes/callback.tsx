import type { LoaderFunction } from "remix";

import { auth } from "~/utils/auth.server";

export const loader: LoaderFunction = async ({ request }) => {
  return auth.authenticate("auth0", request, {
    successRedirect: "/private",
    failureRedirect: "/"
  });
};
