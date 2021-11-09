import { redirect } from "remix";

export let loader = () => {
  return redirect("/");
};
