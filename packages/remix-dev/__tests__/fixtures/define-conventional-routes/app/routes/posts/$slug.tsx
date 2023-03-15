import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { marked } from "marked";

import { getPost } from "~/models/post.server";
import type { Post } from "~/models/post.server";

type LoaderData = { post: Post; html: string };

export const loader: LoaderFunction = async ({ params }) => {
  invariant(params.slug, `params.slug is required`);

  let post = await getPost(params.slug);
  invariant(post, `Post not found: ${params.slug}`);

  let html = marked(post.markdown);
  return json<LoaderData>({ post, html });
};

export default function PostSlug() {
  let { post, html } = useLoaderData() as LoaderData;
  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="my-6 border-b-2 text-center text-3xl">{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
