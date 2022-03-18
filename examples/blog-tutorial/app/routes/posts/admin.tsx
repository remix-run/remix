import type { LoaderFunction } from "remix";
import { Link, useLoaderData, json } from "remix";

import { getPosts } from "~/models/post.server";

type LoaderData = {
  posts: Awaited<ReturnType<typeof getPosts>>;
};

export const loader: LoaderFunction = async () => {
  return json({ posts: await getPosts() });
};

export default function Admin() {
  const { posts } = useLoaderData() as LoaderData;
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="my-6 mb-2 border-b-2 text-center text-3xl">Admin</h1>
      <div className="flex">
        <nav>
          <ul>
            {posts.map((post) => (
              <li key={post.slug}>
                <Link to={post.slug}>{post.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1">...</main>
      </div>
    </div>
  );
}
