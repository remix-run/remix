import { redirect } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { getUser } from "~/session.server";

export const loader: LoaderFunction = async ({ request }) => {
  const user = await getUser(request);
  if (user) {
    return redirect("dashboard");
  }
  return redirect("sign-in");
};
