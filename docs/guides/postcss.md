---
title: PostCSS
---

If you'd like to use PostCSS with Remix, you can set up a quick command in your project, that even trigger rebuilds in development. We do plan to support PostCSS directly soon, but for now this is a decent workflow.

## Create a PostCSS config file

```js
module.exports = {
  plugins: [require("autoprefixer")]
};
```

## Create a "styles" folder

Create a folder in the root of your project (not the app folder) called "styles". These are your css source files. We'll point PostCSS at these to be copied into your app/ folder. This allows you to use the same conventions for CSS that remix uses. Any styles in `styles/routes/**/*.css` will end up in `app/routes/**/*.css`.

## Set up package scripts

These scripts run your `styles/` through PostCSS and output them into your `app/` directory.

```json
{
  "scripts": {
    "build": "NODE_ENV=production yarn run css:build && NODE_ENV=production remix build",
    "css:watch": "postcss styles --base styles --dir app/ -w",
    "css:build": "postcss styles --base styles --dir app/ --env production",
    "start": "NODE_ENV=development concurrently \"yarn run css:watch\" \"remix run\" \"firebase serve\""
  }
}
```

When PostCSS writes files to `app/`, Remix's rebuilds are triggered in development.

## Gitignore

You probably want to gitignore the files written by PostCSS, add this to your `.gitignore` file.

```
app/**/*.css
```
