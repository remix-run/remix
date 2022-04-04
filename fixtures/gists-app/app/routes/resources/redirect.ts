import { redirect } from "@remix-run/node";

export let loader = async () => {
  return redirect("/");
};
