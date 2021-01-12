import { useRouteData } from "@remix-run/react";
import type { Loader } from "@remix-run/data";

export let loader: Loader = async () => {
  return { message: "this is awesome 😎" };
};

export function meta() {
  return {
    title: "Remix Starter",
    description: "Welcome to remix!"
  };
}

export default function Index() {
  let data = useRouteData();

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h2>Welcome to Remix!</h2>
      <p>
        <a href="https://remix.run/dashboard/docs">Check out the docs</a> to get
        started.
      </p>
      <p>Message from the loader: {data.message}</p>
    </div>
  );
}
