import { redirect } from "remix";

export let loader = async () => {
  return redirect("/");
};
