import path from "path";
import fs from "fs/promises";
import parseFrontMatter from "front-matter";
import invariant from "tiny-invariant";
import { marked } from "marked";

export type Post = {
  slug: string;
  title: string;
};

export type PostMarkdownAttributes = {
  title: string;
};

const postsPath = path.join(__dirname, "../posts");

function isValidPostAttributes(
  attributes: any
): attributes is PostMarkdownAttributes {
  return attributes?.title;
}

type NewPost = {
  title: string;
  slug: string;
  markdown: string;
};

export async function createPost(post: NewPost) {
  const md = `---\ntitle: ${post.title}\n---\n\n${post.markdown}`;
  await fs.writeFile(path.join(postsPath, post.slug + ".md"), md);
  return getPost(post.slug);
}

export async function getPost(slug: string) {
  const filepath = path.join(postsPath, slug + ".md");
  const file = await fs.readFile(filepath);
  const { attributes, body } = parseFrontMatter(file.toString());
  invariant(
    isValidPostAttributes(attributes),
    `Post ${filepath} is missing attributes`
  );
  const html = marked(body);
  return { slug, html, title: attributes.title };
}


export async function getPosts() {
  const postOrSeriesBasenames = await fs.readdir(
    `${__dirname}/../../../posts`,
    { withFileTypes: true }
  );

  const posts = await Promise.all(
    postOrSeriesBasenames
      .map(async (dirent) => {
        const file = await fs.readFile(
          path.join(`${__dirname}/../../../posts`, dirent.name)
        );
        const { attributes } = parseFrontMatter(file.toString());
        invariant(isValidPostAttributes(attributes));
        return {
          slug: dirent.name.replace(/\.md/, ""),
          title: attributes.title,
        };

      })
  );

  return posts;
}

