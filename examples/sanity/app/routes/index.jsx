import { useLoaderData } from "remix";
import { Link } from "react-router-dom";

import { getClient } from "~/lib/sanity/getClient";

import stylesUrl from "../styles/index.css";

export function meta() {
  return {
    title: "Remix Starter",
    description: "Welcome to remix!"
  };
}

export function links() {
  return [{ rel: "stylesheet", href: stylesUrl }];
}

export async function loader() {
  const movies = await getClient().fetch(
    `*[_type == "movie"]{ _id, title, slug }`
  );

  return { movies };
}

export default function Index() {
  const { movies } = useLoaderData();

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      {movies?.length > 1
        ? movies.map(movie => (
            <div style={{ padding: 10 }} key={movie._id}>
              <Link to={movie.slug.current}>{movie.title}</Link>
            </div>
          ))
        : null}
    </div>
  );
}
