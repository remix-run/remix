---
title: Performance
---

# Performance

<docs-warning>This document is in draft, we will be adding more practical information soon, but we wanted to communicate our approach early.</docs-warning>

Instead of prescribing a precise architecture with all of it's constraints like SSG, Remix is designed to encourage you to leverage the performance characteristics of distributed computing.

The fastest thing to send to a user is, of course, a static document on a CDN that's close to the user. Until recently, servers pretty much only ran in one region of the world, which made for slow responses everywhere else. This is perhaps one reason SSG gained so much popularity, it allowed developers to essentially "cache" their data into HTML documents and then distribute them across the world. It comes with a lot of tradeoffs too: build times, build complexity, duplicate websites for translations, can't use it for authenticated user experiences, can't use it for very large and dynamic data sources (like our project [unpkg.com](https://unpkg.com)!) to name a few.

## The Edge

(No, not the U2 guy.)

Today, there are a lot of exciting things happening with distributed computing "at the edge". Computing "at the edge" generally means running code on servers close to users instead of just one place (like the US East Coast). We're not only seeing more of this, but we're seeing distributed databases moving to the edge as well. We've been anticipating all of this for a while, that's why Remix is designed the way it is.

With distributed servers and databases running at the edge, it's now possible to serve dynamic content at speeds comparable to static files. **You can make your server fast, but you can't do anything about the users network**. The only thing left to do is get code out of your browser bundles and onto the server, sending fewer bytes over the network, and provide unparalleled web performance. That's what Remix is designed to do.

## This Website + Fly.io

This very website has a time to first byte that's hard to beat. For most people in the world it's under 100ms. We can fix a typo in the docs and within a minute or two the site is updated across the world without a rebuild, without a redeploy, and without HTTP caching.

We accomplished this with distributed systems. The app runs in several regions on [Fly](https://fly.io) around the world so it's close to you. Each instance has its own SQLite database. When the app boots, it fetches tarballs from the Remix source repository on GitHub, processes the markdown docs into HTML and then inserts them into the SQLite database.

The code involved is actually really similar to what a Gatsby site might do at build time in `gatsby-node.js` or `getStaticProps` in Next.js. The idea is to take the slow parts (fetching docs from GitHub, processing markdown) and cache it (SSG caches into HTML, this website caches into SQLite on the server).

When users request a page, the app queries its local SQLite database and sends the page. Our server is done with these requests in a few milliseconds. What's most interesting about this architecture is that we don't have to sacrifice speed for freshness. When we edit a doc on GitHub, a GitHub action calls a webhook on the nearest app instance, which then replays that request to all of the other instances across the world. Then they all pull the new tarball from GitHub and sync their database with the docs just like they did when they booted. The docs are updated within a minute or two across the world.

But this is just one approach that we wanted to explore.

## Cloudflare Workers

[Remix Cloudflare Workers Demo](https://remix-cloudflare-demo.jacob-ebey.workers.dev)

Cloudflare has been pushing the boundaries of edge computing for a while now and Remix is positioned to take full advantage of it. You can see our demo's response times are the same as serving static files but the features it demostrates are definitely not static!

Not only does Cloudflare run the app close to the user, they also have persistent storage systems like [KV](https://developers.cloudflare.com/workers/learning/how-kv-works) and [Durable Objects](https://blog.cloudflare.com/introducing-workers-durable-objects) to allow SSG-level speed without the handcuffs of coupling data to deploys and bespoke incremental builder backends.

There are other similar platforms that we've got plans to support soon.

## Other Technologies

Here are some other technologies to help speed up your servers:

- [FaunaDB](https://fauna.com/) - a distributed database that runs close to your users
- [LRU Cache](https://www.npmjs.com/package/lru-cache) - in memory cache that automatically clears out more space when it gets full
- [Redis](https://www.npmjs.com/package/redis) - tried and true server side cache
