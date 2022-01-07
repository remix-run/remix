import type { LoaderFunction } from "remix";
import React from "react";
import { useLoaderData } from "remix";
import { marked } from "marked";

type Post = {
  title: string;
  article: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
};

type PostData = { id: string; attributes: Post }[];

type PostResponse = {
  data: PostData;
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
};

export const loader: LoaderFunction = async () => {
  // This is where Remix integrates with Strapi
  const response = await fetch("http://localhost:1337/api/posts");
  const postResponse = (await response.json()) as PostResponse;

  return postResponse.data.map(post => ({
    ...post,
    attributes: {
      ...post.attributes,
      article: marked(post.attributes.article)
    }
  }));
};

const Posts: React.FC = () => {
  const posts = useLoaderData<PostData>();

  return (
    <>
      {posts.map(post => {
        const { title, article, createdAt } = post.attributes;
        const date = new Date(createdAt).toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        });

        return (
          <article key={post.id}>
            <h1>{title}</h1>
            <time dateTime={createdAt}>{date}</time>
            {/* Reminder that this can in fact be dangerous
                https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml */}
            <div dangerouslySetInnerHTML={{ __html: article }} />
          </article>
        );
      })}
    </>
  );
};
export default Posts;
