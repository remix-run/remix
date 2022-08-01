import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import type { FunctionComponent } from "react";

import { getClient } from "~/lib/sanity";

type Movie = {
  _id: string;
  slug: { current: string };
  title: string;
};
export const loader: LoaderFunction = async () => {
  const movies = await getClient().fetch(
    `*[_type == "movie"]{ _id, title, slug }`
  );

  return json<{ movies: Movie[] }>({ movies });
};

export const meta: MetaFunction = () => ({
  title: "Remix Starter",
  description: "Welcome to remix!",
});

const Index: FunctionComponent = () => {
  const { movies } = useLoaderData<{ movies: Movie[] }>();

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      {movies.map((movie) => (
        <div style={{ padding: 10 }} key={movie._id}>
          <Link to={movie.slug.current}>{movie.title}</Link>
        </div>
      ))}
    </div>
  );
};
export default Index;
