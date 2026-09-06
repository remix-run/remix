<br />
<br />

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/remix-wordmark-racing-darkmode.svg">
    <img alt="Remix" src=".github/assets/remix-wordmark-racing-lightmode.svg" width="400">
  </picture>
</p>

<br />
<br />

# Welcome to Remix 3!

This is the source repository for Remix 3. It is under active development.

We published [a blog post](https://remix.run/blog/wake-up-remix) earlier this year with some of our thoughts around Remix 3. It explains our philosophy for web development and why we think the time is right for something new. When working on Remix 3, we follow these principles:

1. **Model-First Development**. AI fundamentally shifts the human-computer interaction model for both user experience and developer workflows. Optimize the source code, documentation, tooling, and abstractions for LLMs. Additionally, develop abstractions for applications to use models in the product itself, not just as a tool to develop it.
2. **Build on Web APIs**. Sharing abstractions across the stack greatly reduces the amount of context switching, both for humans and machines. Build on the foundation of Web APIs and JavaScript because it is the only full stack ecosystem.
3. **Religiously Runtime**. Designing for bundlers/compilers/typegen (and any pre-runtime static analysis) leads to poor API design that eventually pollutes the entire system. All packages must be designed with no expectation of static analysis and all tests must run without bundling. Because browsers are involved, `--import` loaders for simple transformations like TypeScript and JSX are permissible.
4. **Avoid Dependencies**. Dependencies lock you into somebody else's roadmap. Choose them wisely, wrap them completely, and expect to replace most of them with our own package eventually. The goal is zero.
5. **Demand Composition**. Abstractions should be single-purpose and replaceable. A composable abstraction is easy to add and remove from an existing program. Every package must be useful and documented independent of any other context. New features should first be attempted as a new package. If impossible, attempt to break up the existing package to make it more composable. However, tightly coupled modules that almost always change together in both directions should be moved to the same package.
6. **Distribute Cohesively**. Extremely composable ecosystems are difficult to learn and use. Remix will be distributed as a single `remix` package for both distribution and documentation.

## Goals

Although we recommend the `remix` package for ease of use, all packages that make up Remix should be usable standalone as well. This forces us to consider package boundaries and helps us define public interfaces that are portable and interoperable.

Each package in Remix:

- Has a [single responsibility](https://en.wikipedia.org/wiki/Single-responsibility_principle)
- Prioritizes web standards to ensure maximum interoperability and portability across JavaScript runtimes
- Augments standards unobtrusively where they are missing or incomplete, minimizing incompatibility risks

This means Remix code is **portable by default**. Remix packages work seamlessly across [Node.js](https://nodejs.org/), [Bun](https://bun.sh/), [Deno](https://deno.com/), [Cloudflare Workers](https://workers.cloudflare.com/), and other environments.

We leverage server-side web APIs when they are available:

- [The Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) instead of `node:stream`
- [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) instead of Node.js `Buffer`s
- [The Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) instead of `node:crypto`
- [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) instead of some bespoke runtime-specific API

The benefit is code that's not just reusable, but **future-proof**.

## Packages

Most packages in this repository are standalone JavaScript/TypeScript tools. The `remix` package composes them under one umbrella for distribution and documentation.

- [assert](packages/assert): Node assert-compatible utilities for any JavaScript environment
- [assets](packages/assets): Fetch-based server for compiling browser JS/TS and CSS assets on demand
- [async-context-middleware](packages/async-context-middleware): Middleware for storing request context in AsyncLocalStorage
- [auth](packages/auth): Browser login, OAuth, and OIDC helpers for Remix
- [auth-middleware](packages/auth-middleware): Pluggable authentication middleware for Remix
- [cli](packages/cli): Command-line interface for Remix
- [compression-middleware](packages/compression-middleware): Middleware for compressing HTTP responses
- [cookie](packages/cookie): A toolkit for working with cookies in JavaScript
- [cop-middleware](packages/cop-middleware): Middleware for tokenless cross-origin protection in Fetch API servers
- [cors-middleware](packages/cors-middleware): Middleware for handling CORS in Fetch API servers
- [csrf-middleware](packages/csrf-middleware): Middleware for CSRF protection in Fetch API servers
- [data-schema](packages/data-schema): Tiny, standards-aligned schema validation
- [data-table](packages/data-table): A typed, relational query toolkit for JavaScript
- [data-table-mysql](packages/data-table-mysql): MySQL database implementation for remix/data-table
- [data-table-postgres](packages/data-table-postgres): PostgreSQL database implementation for remix/data-table
- [data-table-sqlite](packages/data-table-sqlite): SQLite database implementation for remix/data-table
- [fetch-proxy](packages/fetch-proxy): An HTTP proxy for the web Fetch API
- [fetch-router](packages/fetch-router): A minimal, composable router for the web Fetch API
- [file-storage](packages/file-storage): Key/value storage for JavaScript File objects
- [file-storage-s3](packages/file-storage-s3): S3 backend for remix/file-storage
- [form-data-middleware](packages/form-data-middleware): Middleware for parsing FormData from request bodies
- [form-data-parser](packages/form-data-parser): A request.formData() wrapper with streaming file upload handling
- [fs](packages/fs): Filesystem utilities using the Web File API
- [headers](packages/headers): A toolkit for working with HTTP headers in JavaScript
- [html-template](packages/html-template): HTML template tag with auto-escaping for JavaScript
- [lazy-file](packages/lazy-file): Lazy, streaming files for JavaScript
- [logger-middleware](packages/logger-middleware): Middleware for logging HTTP requests and responses
- [method-override-middleware](packages/method-override-middleware): Middleware for overriding HTTP request methods from form data
- [mime](packages/mime): Utilities for working with MIME types
- [multipart-parser](packages/multipart-parser): A fast, efficient parser for multipart streams in any JavaScript environment
- [node-fetch-server](packages/node-fetch-server): Build servers for Node.js using the web fetch API
- [node-hmr](packages/node-hmr): Run Node.js applications with hot module reloading
- [node-tsx](packages/node-tsx): Run Node.js with TypeScript and JSX syntax support
- [remix](packages/remix): The Remix web framework
- [response](packages/response): Response helpers for the web Fetch API
- [route-pattern](packages/route-pattern): Match and generate URLs with strong typing
- [session](packages/session): Session management for JavaScript
- [session-middleware](packages/session-middleware): Middleware for managing sessions with cookie-based storage
- [session-storage-memcache](packages/session-storage-memcache): Memcache session storage for remix/session
- [session-storage-redis](packages/session-storage-redis): Redis session storage for remix/session
- [static-middleware](packages/static-middleware): Middleware for serving static files from the filesystem
- [tar-parser](packages/tar-parser): A fast, efficient parser for tar streams in any JavaScript environment
- [terminal](packages/terminal): Terminal output utilities for JavaScript libraries and CLIs
- [test](packages/test): A test framework for JavaScript and TypeScript projects
- [ui](packages/ui): View layer with reconciler, component model, and first-party UI components
- [ui-hmr](packages/ui-hmr): Hot module replacement runtime and transforms for Remix UI components

## Installation

To try the current Remix beta, install the `next` dist-tag:

```sh
npm install remix@next
```

To create a new Remix app with the CLI, use `npx remix@next new`:

```sh
npx remix@next new my-remix-app
```

If you want to play around with the bleeding edge, we also build the latest `main` branch into a `preview/main` branch which can be [installed directly](https://pnpm.io/package-sources#install-from-a-git-repository-combining-different-parameters) with `pnpm` (version 9+):

```sh
pnpm install "remix-run/remix#preview/main&path:packages/remix"
```

Or, just install a single package:

```
pnpm install "remix-run/remix#preview/main&path:packages/fetch-router"
```

## Agent Skills For Building Apps

Agents that are starting a Remix 3 app from this repository should use the [`remix` app skill](./.agents/skills/remix/SKILL.md). The CLI prepack step copies this skill into the app template so generated apps can use the same guidance.

## Contributing

We welcome contributions! If you'd like to contribute, please feel free to open an issue or submit a pull request. See [CONTRIBUTING](https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md) for more information.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)


## 🌐 Web Resources & Interactive Index
- [EXTREME CAR RACE MASTER 3D](https://thequizzone.pages.dev/extreme-car-race-master-3d.html)
- [THE BRANCH RUNNER](https://studyquests.pages.dev/the-branch-runner.html)
- [METAL GUNS FURY](https://studyquests.github.io/metal-guns-fury.html)
- [SUIKA KAWAII CAT MERGE GAME](https://studyquests.pages.dev/suika-kawaii-cat-merge-game.html)
- [INDEX8](https://studyquests.github.io/index8.html)
- [CATEGORY PHYSICS371](https://thelearnquester.web.app/category-physics371.html)
- [CATEGORY LOGIC538](https://studyquests.pages.dev/category-logic538.html)
- [MR BOUNCE](https://quizverses.pages.dev/mr-bounce.html)
- [BLOCK PUZZLE KING](https://studyquests.pages.dev/block-puzzle-king.html)
- [CLEANING SIMULATOR](https://learnquester.github.io/cleaning-simulator.html)
- [CATEGORY DRAWING34](https://studyplayings.pages.dev/category-drawing34.html)
- [EVERYTHING IS IN PLACE RARE FINDS](https://learnquester.github.io/everything-is-in-place-rare-finds.html)
- [STRAWBERRY HERO](https://quizverses.pages.dev/strawberry-hero.html)
- [INDEX13](https://quizverses.github.io/index13.html)
- [WORD MINE](https://learnquester.github.io/word-mine.html)
- [GRILL IT ALL](https://studyquests.pages.dev/grill-it-all.html)
- [FUN MINI GAMES FOR KIDS](https://studyquests.github.io/fun-mini-games-for-kids.html)
- [HOME RUSH THE FISH WAR](https://studyquests.pages.dev/home-rush-the-fish-war.html)
- [IDLE LUNCH](https://studyquests.pages.dev/idle-lunch.html)
- [EUROPE AT WAR](https://studyplayings.web.app/europe-at-war.html)
- [COLLECT EM ALL](https://studyquests.pages.dev/collect-em-all.html)
- [MACHINE CITY BALLS](https://studyquests.pages.dev/machine-city-balls.html)
- [MEGA JUMP](https://quizverses.github.io/mega-jump.html)
- [MERGE CUBES 2048 3D](https://quizverses.github.io/merge-cubes-2048-3d.html)
- [ONLINE PORTAL](https://cryptotify.github.io/)
- [GREATSWORD V3](https://quizverses.pages.dev/greatsword-v3.html)
- [STAR ATTACK 3D](https://studyquesthub.web.app/star-attack-3d.html)
- [CATEGORY IDLE448](https://studyquesthub.web.app/category-idle448.html)
- [STICKMAN KOMBAT 2D](https://learnquester.github.io/stickman-kombat-2d.html)
- [CATEGORY CONTROLLER](https://studyquesthub.web.app/category-controller.html)
- [TILE FARM STORY MATCHING GAME](https://quizverses.github.io/tile-farm-story-matching-game.html)
- [INDIAN SUV OFFROAD SIMULATOR](https://studyquests.pages.dev/indian-suv-offroad-simulator.html)
- [CATEGORY MMO24](https://studyquesthub.web.app/category-mmo24.html)
- [CATEGORY CASUAL971](https://studyquesthub.web.app/category-casual971.html)
- [SUPERMARKET MANAGER SIMULATOR](https://studyquests.github.io/supermarket-manager-simulator.html)
- [CATEGORY BATTLE](https://quizverses.github.io/category-battle.html)
- [CATEGORY SPACE](https://quizverses.pages.dev/category-space.html)
- [STEAL A FISH](https://quizverses.pages.dev/steal-a-fish.html)
- [HORDE HUNTERS](https://studyplayings.web.app/horde-hunters.html)
- [SOLITAIRE STORY TRIPEAKS 6](https://quizverses.github.io/solitaire-story-tripeaks-6.html)
- [ULTIMATE BRAINROT CLICKER](https://quizverses.github.io/ultimate-brainrot-clicker.html)
- [POP PUZZLE](https://studyquests.pages.dev/pop-puzzle.html)
- [TAP TAP BUILDER](https://studyquests.pages.dev/tap-tap-builder.html)
- [IDLE PET](https://studyquests.pages.dev/idle-pet.html)
- [INDEX33](https://quizverses.github.io/index33.html)
- [LABUBU DOLL MUKBANG ASMR UNBLOCKED](https://quizverses.pages.dev/labubu-doll-mukbang-asmr-unblocked.html)
- [CATEGORY 3D1 371](https://quizverses.pages.dev/category-3d1-371.html)
- [MERGE FRUIT](https://quizverses.pages.dev/merge-fruit.html)
- [GLOBAL CITY QKK](https://quizverses.pages.dev/global-city-qkk.html)
- [SITEMAP](https://cryptotify.github.io/sitemap.html)
- [CATEGORY BATTLE524](https://quizverses.pages.dev/category-battle524.html)
- [FASHION WORLD SIMULATOR](https://studyquests.pages.dev/fashion-world-simulator.html)
- [CATEGORY CASUAL 8](https://learnquester.pages.dev/category-casual-8.html)
- [HIDDEN OBJECT MY HOTEL](https://quizverses.pages.dev/hidden-object-my-hotel.html)
- [CATEGORY 3D1 371](https://thelearnquester.web.app/category-3d1-371.html)
- [CATEGORY CASUAL 11](https://studyplaying.github.io/category-casual-11.html)
- [CATEGORY AGILITY 2](https://thelearnquester.web.app/category-agility-2.html)
- [CATEGORY BOARDGAMES](https://learnquester.github.io/category-boardgames.html)
- [VENETIAN LOVE AFFAIR](https://studyplayings.web.app/venetian-love-affair.html)
- [SPRUNKI POPIT](https://learnquester.pages.dev/sprunki-popit.html)
- [CATEGORY MONSTER206](https://learnquester.pages.dev/category-monster206.html)
- [2 3 4 PLAYER GAMES](https://thelearnquester.web.app/2-3-4-player-games.html)
- [CATEGORY SNAKE](https://studyplayings.web.app/category-snake.html)
- [CATEGORY BUBBLE SHOOTER](https://quizverses.pages.dev/category-bubble-shooter.html)
- [CATEGORY SHOOTER 2](https://studyquests.pages.dev/category-shooter-2.html)
- [CATEGORY RACING DRIVING 2](https://studyquesthub.web.app/category-racing-driving-2.html)
- [TILES MATCHING](https://learnquester.github.io/tiles-matching.html)
- [TENNIS MASTERS 2026](https://quizverses.pages.dev/tennis-masters-2026.html)
- [LEGEND OF FIREBALL](https://quizverses.github.io/legend-of-fireball.html)
- [100 DOORS PUZZLE BOX](https://learnquester.pages.dev/100-doors-puzzle-box.html)
- [CATEGORY UNBLOCKED WEBSITES](https://thelearnquester.web.app/category-unblocked-websites.html)
- [CLASH CROWD GAME](https://studyplayings.web.app/clash-crowd-game.html)
- [CONTACT](https://learnquester.github.io/contact.html)
- [CATEGORY PIXEL313](https://studyplaying.github.io/category-pixel313.html)
- [GIRLS FUN NAIL SALON](https://studyplayings.web.app/girls-fun-nail-salon.html)
- [SERIOUS BRO](https://learnquester.pages.dev/serious-bro.html)
- [INDEX6](https://studyplayings.web.app/index6.html)
- [ZOMBIE CHASE](https://quizverses.pages.dev/zombie-chase.html)
- [CATEGORY MISSION207](https://studyplayings.web.app/category-mission207.html)
- [CATEGORY MAKEUP51](https://studyquests.github.io/category-makeup51.html)
- [MERGE GALAXY](https://studyquests.pages.dev/merge-galaxy.html)
- [PIN MASTER](https://studyquests.pages.dev/pin-master.html)
- [PURRFECT BAKERY](https://quizverses.github.io/purrfect-bakery.html)
- [CATEGORY BIKE](https://thelearnquester.web.app/category-bike.html)
- [FROG KNIGHT](https://quizverses.github.io/frog-knight.html)
- [CATEGORY MINECRAFT](https://studyquesthub.web.app/category-minecraft.html)
- [CATEGORY INTERSTELLARPROXY](https://studyquests.github.io/category-interstellarproxy.html)
- [CATEGORY 3D1 371](https://learnquester.pages.dev/category-3d1-371.html)
- [HIDDEN OBJECTS ISLAND](https://studyquests.pages.dev/hidden-objects-island.html)
- [DINO SURVIVAL 3D SIMULATOR](https://studyquests.pages.dev/dino-survival-3d-simulator.html)
- [CATEGORY DRESS UP97](https://quizverses.pages.dev/category-dress-up97.html)
- [MONSTER SQUAD RUSH](https://learnquester.github.io/monster-squad-rush.html)
- [SPACE STRIKE GALAXY SHOOTER](https://thelearnquester.web.app/space-strike-galaxy-shooter.html)
- [CATEGORY CASUAL 2](https://quizverses.pages.dev/category-casual-2.html)
- [DR PARKING](https://studyquests.pages.dev/dr-parking.html)
- [CATEGORY MONSTER206](https://studyplaying.github.io/category-monster206.html)
- [CATEGORY MERGE GAMES](https://studyquesthub.web.app/category-merge-games.html)
- [ANIMATION COLORING ALPHABET LORE](https://thelearnquesters.pages.dev/animation-coloring-alphabet-lore.html)
- [CATEGORY TOWER DEFENSE118](https://thelearnquesters.pages.dev/category-tower-defense118.html)
- [BUBBLE SHOOTER FREE 3](https://thelearnquesters.pages.dev/bubble-shooter-free-3.html)
- [MAHJONG CUTE TILES](https://thelearnquesters.pages.dev/mahjong-cute-tiles.html)
- [GORILLA ADVENTURE](https://studyquests.pages.dev/gorilla-adventure.html)
- [ASMR WASHING FIXING](https://thelearnquester.web.app/asmr-washing-fixing.html)
- [CATEGORY MERGE224](https://studyplaying.github.io/category-merge224.html)
- [JENNYS MATH PUZZLE](https://studyquesthub.web.app/jennys-math-puzzle.html)
- [POCKET PARKING](https://studyquests.pages.dev/pocket-parking.html)
- [GUN CRAFT RUN WEAPON FIRE](https://learnquesters.pages.dev/gun-craft-run-weapon-fire.html)
- [CATEGORY COLOR197](https://themindplay.github.io/category-color197.html)
- [BUILD YOUR AQUARIUM](https://learnquesters.pages.dev/build-your-aquarium.html)
- [OFFICE ESCAPE TO DATE](https://learnquesters.pages.dev/office-escape-to-date.html)
- [MAGIC PIANO MUSIC](https://thelearnquesters.pages.dev/magic-piano-music.html)
- [CATEGORY TURN BASED30](https://studyquesthub.web.app/category-turn-based30.html)
- [PHOTO BLOCK JOURNEY](https://thelearnquesters.pages.dev/photo-block-journey.html)
- [CATEGORY BUBBLE SHOOTER27](https://studyquesthub.web.app/category-bubble-shooter27.html)
- [SCREW MATCH](https://thelearnquesters.pages.dev/screw-match.html)
- [NUMBER MASTER RUN AND MERGE](https://thelearnquester.web.app/number-master-run-and-merge.html)
- [REAL GT RACING SIMULATOR](https://learnquester.pages.dev/real-gt-racing-simulator.html)
- [MEMORY MATCH MAGIC](https://studyquests.pages.dev/memory-match-magic.html)
- [CATEGORY OBBY56](https://quizverses.pages.dev/category-obby56.html)
- [FALLING BLOCKS PUZZLE](https://quizverses.github.io/falling-blocks-puzzle.html)
- [EGG FARM](https://learnquester.github.io/egg-farm.html)
- [BATTLE ARENA](https://thelearnquesters.pages.dev/battle-arena.html)
- [CATEGORY 2D1 070](https://quizverses.pages.dev/category-2d1-070.html)
- [CATEGORY BATTLE](https://thelearnquester.web.app/category-battle.html)
- [BOOM LAND LITE](https://quizverses.pages.dev/boom-land-lite.html)
- [CATEGORY CLASSIC98](https://themindzone.pages.dev/category-classic98.html)
- [HALLOWEEN FRUIT SLICE](https://thequizzone.pages.dev/halloween-fruit-slice.html)
- [BUBBLE SHOOTER NEON](https://learnquesters.pages.dev/bubble-shooter-neon.html)
- [CATEGORY GITHUB IO](https://thelearnquester.web.app/category-github-io.html)
- [SAVE THE CROP](https://studyplayings.pages.dev/save-the-crop.html)
