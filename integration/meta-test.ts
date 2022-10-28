import { test, expect } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { PlaywrightFixture } from "./helpers/playwright-fixture";

test.describe("meta", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  // disable JS for all tests in this file
  // to only disable them for some, add another test.describe()
  // and move the following line there
  test.use({ javaScriptEnabled: false });

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
          import { json } from "@remix-run/node";
          import { Meta, Links, Outlet, Scripts } from "@remix-run/react";

          export const loader = async () =>
            json({
              description: "This is a meta page",
              title: "Meta Page",
            });

          export const meta = ({ data }) => ({
            charset: "utf-8",
            description: data.description,
            "og:image": "https://picsum.photos/200/200",
            "og:type": data.contentType, // undefined
            refresh: {
              httpEquiv: "refresh",
              content: "3;url=https://www.mozilla.org",
            },
            title: data.title,
          });

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/index.jsx": js`
          export default function Index() {
            return <div>This is the index file</div>;
          }
        `,

        "app/routes/music.jsx": js`
          export function meta({ data }) {
            return {
              title: "What's My Age Again?",
              "og:type": "music.song",
              "music:musician": "https://www.blink182.com/",
              "music:duration": 182,
            };
          }

          export default function Music() {
            return <h1>Music</h1>;
          }
        `,

        "app/routes/video.jsx": js`
          export function meta({ data }) {
            return {
              title: "Catch Me If You Can",
              "og:type": "video.movie",
              "video:actor": "Leonardo DiCaprio",
              "video:actor:role": "Frank Abagnale Jr.",
              "video:director": "Steven Spielberg",
            };
          }

          export default function Video() {
            return <h1>Video</h1>;
          }
        `,

        "app/routes/book.jsx": js`
          export function meta({ data }) {
            return {
              title: "The Hitchhiker's Guide to the Galaxy",
              "og:type": "book",
              "book:author": "Douglas Adams",
              "book:isbn": "0345391802",
            };
          }

          export default function Book() {
            return <h1>Book</h1>;
          }
        `,

        "app/routes/profile.jsx": js`
          export function meta({ data }) {
            return {
              title: "Chance's Profile",
              "og:type": "profile",
              "profile:first_name": "Chance",
              "profile:last_name": "Strickland",
              "profile:username": "chancethedev",
            };
          }

          export default function Profile() {
            return <h1>Profile</h1>;
          }
        `,

        "app/routes/bogus.jsx": js`
          export function meta({ data }) {
            return {
              title: "Bogus page",
              "bogus:value": "Whatever man",
            };
          }

          export default function Profile() {
            return <h1>Profile</h1>;
          }
        `,

        "app/routes/blog.jsx": js`
          import { Outlet } from "@remix-run/react";

          export const meta = ({ data }) => ({
            title: "Blog",
            description: "The best blog on earth",
            "og:image": "https://picsum.photos/300/300",
            "og:type": "article",
            "article:author": ["Logan McAnsh", "Chance Strickland"],
          });

          export default function BlogLayout() {
            return (
              <div>
                <h1>Blog</h1>
                <Outlet />
              </div>
            );
          }
        `,

        "app/routes/blog/index.jsx": js`
          import { Link, useLoaderData } from "@remix-run/react";
          import { json } from "@remix-run/node";

          const posts = [
            { id: 1, title: "Post 1", content: "This is post 1" },
            { id: 2, title: "Post 2", content: "This is post 2", author: "Ryan Florence" },
            { id: 3, title: "Post 3", content: "This is post 3" },
          ];

          export const loader = async () => json({ posts });

          export function meta({ data }) {
            return {
              title: "Blog Posts",
            };
          }

          export default function BlogIndex() {
            let { posts } = useLoaderData();
            return (
              <ul>
                {posts.map((post) => (
                  <li key={post.id}>
                    <Link to={"/blog/" + post.id}>{post.title}</Link>
                  </li>
                ))}
              </ul>
            );
          }
        `,

        "app/routes/blog/$pid.jsx": js`
          import { useLoaderData } from "@remix-run/react";
          import { json } from "@remix-run/node";

          const posts = [
            { id: 1, title: "Post 1", content: "This is post 1" },
            { id: 2, title: "Post 2", content: "This is post 2", author: "Ryan Florence" },
            { id: 3, title: "Post 3", content: "This is post 3" },
          ];

          export async function loader({ params }) {
            let post = posts.find((post) => post.id === Number(params.pid));
            if (!post) {
              throw json(null, 404);
            }
            return json(post);
          }

          export function meta({ data }) {
            let meta = {
              title: data.title + " | Blog",
            };
            if (data.author) {
              meta["article:author"] = data.author;
            }
            return meta;
          }

          export default function BlogPost() {
            let post = useLoaderData();
            return (
              <div>
                <h1>{post.title}</h1>
                <p>{post.content}</p>
              </div>
            );
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(() => appFixture.close());

  test("empty meta does not render a tag", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    await expect(app.getHtml('meta[property="og:type"]')).rejects.toThrowError(
      'No element matches selector "meta[property="og:type"]"'
    );
  });

  test("{ charset } adds a <meta charset='utf-8' />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml('meta[charset="utf-8"]')).toBeTruthy();
  });

  test("{ title } adds a <title />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml("title")).toBeTruthy();
  });

  test("{ 'og:*' } adds a <meta property='og:*' />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    expect(await app.getHtml('meta[property="og:image"]')).toBeTruthy();
  });

  test("{ 'music:*' } adds a <meta property='music:*' />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/music");
    expect(await app.getHtml('meta[property="music:musician"]')).toBeTruthy();
  });

  test("{ 'video:*' } adds a <meta property='video:*' />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/video");
    expect(await app.getHtml('meta[property="video:actor"]')).toBeTruthy();
  });

  test("{ 'book:*' } adds a <meta property='book:*' />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/book");
    expect(await app.getHtml('meta[property="book:author"]')).toBeTruthy();
  });

  test("{ 'profile:*' } adds a <meta property='profile:*' />", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/profile");
    expect(await app.getHtml('meta[property="profile:username"]')).toBeTruthy();
  });

  test("{ 'article:*' } adds a <meta property='article:*' />", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/blog");
    expect(await app.getHtml('meta[property="article:author"]')).toBeTruthy();
  });

  test("{ description } adds a <meta name='description' />", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(await app.getHtml('meta[name="description"]')).toBeTruthy();
  });

  test("{ refresh } adds a <meta http-equiv='refresh' content='3;url=https://www.mozilla.org' />", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");

    expect(
      await app.getHtml(
        'meta[http-equiv="refresh"][content="3;url=https://www.mozilla.org"]'
      )
    ).toBeTruthy();
  });

  test("unrecognized key adds a <meta name='[VALUE]' />", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/bogus");
    expect(await app.getHtml('meta[name="bogus:value"]')).toBeTruthy();
  });

  test.describe("in nested routes", () => {
    test("meta from layout routes are inherited", async ({ page }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/blog");

      expect(
        await app.getHtml(
          'meta[name="description"][content="The best blog on earth"]'
        )
      ).toBeTruthy();
    });

    test("meta from layout routes can be overridden", async ({ page }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/blog");
      expect(await app.getHtml("title")).toBe("<title>Blog Posts</title>");
    });
  });
});
