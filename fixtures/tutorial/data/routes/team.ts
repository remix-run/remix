import type { Loader } from "@remix-run/data";

let loader: Loader = () => {
  return fetch("https://api.github.com/orgs/reacttraining/members");
};

export { loader };
