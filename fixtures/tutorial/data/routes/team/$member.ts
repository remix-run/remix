import type { Loader } from "@remix-run/data";

let loader: Loader = ({ params }) => {
  return fetch(`https://api.github.com/users/${params.member}`);
};

export { loader };
