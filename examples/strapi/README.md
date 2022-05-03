# Strapi example

This is an example showing a basic integration of Remix with [Strapi](https://strapi.io).

## Example

### Getting started

First, install dependencies in both the root folder (right here) and the `strapi/` folder

```bash
npm i && (cd strapi && npm i)
```

Then, start both the Remix and the Strapi app [concurrently](https://github.com/open-cli-tools/concurrently) with

```bash
npm run dev
```

### Strapi

In this example, a Strapi project was scaffolded at `strapi/`. The installation type is `Quickstart`, which uses [SQLite](https://www.sqlite.org/index.html) as its default database. You can find it at `strapi/.tmp/data.db`.

> Note that in a real app, you'd likely have either a separate repository or a monorepo setup for your Strapi app. This is for demo purposes only.

#### Administration Panel

Strapi's administration panel is at http://localhost:1337/admin.

<pre>
# Credentials
Email:    <strong>strapi@remix.example</strong>
Password: <strong>Passw0rd</strong>
</pre>

#### Collection Types & Content

Besides `User`, there is another [collection type](https://docs.strapi.io/user-docs/latest/content-manager/introduction-to-content-manager.html#collection-types) `Post` with the fields `Title (Text)` and `Article (Rich text)`.

You'll find one pre-written article in the [content manager](https://docs.strapi.io/user-docs/latest/content-manager/writing-content.html#filling-up-fields). Feel free to add some more!

### Remix

The Remix app is at http://localhost:3000.

It has exactly one route `app/routes/index.tsx` which utilises a loader function to fetch all `Posts` [from an external API (Remix docs)](https://remix.run/guides/data-loading#external-apis), which in this case is Strapi's API.

Remix will then continue to render all the posts. To show a somewhat real-world example, the loader parses the `Article (Rich text)` (aka Markdown) into HTML with the help of [marked](https://github.com/markedjs/marked).
