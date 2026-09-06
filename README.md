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
- [PLANT GIRL DEFENSE ZOMBIE](https://themindplays.pages.dev/plant-girl-defense-zombie.html)
- [HEX SENSE](https://studyquests.github.io/hex-sense.html)
- [BOMBARDINO CROCODILO TERROR JUMPSCARE](https://thelearnquesters.pages.dev/bombardino-crocodilo-terror-jumpscare.html)
- [RAGDOLL JUMP](https://learnquesters.pages.dev/ragdoll-jump.html)
- [REAL STREET FIGHTER 3D](https://learnquesters.pages.dev/real-street-fighter-3d.html)
- [BALL DROP](https://studyquesthub.web.app/ball-drop.html)
- [BLOCK CRAFT 3D SCHOOL](https://learnquesters.pages.dev/block-craft-3d-school.html)
- [HUGGY WUGGY GUESS THE RIGHT DOOR](https://learnquesters.pages.dev/huggy-wuggy-guess-the-right-door.html)
- [MAHJONG RIDDLES EGYPT](https://studyquests.github.io/mahjong-riddles-egypt.html)
- [SOCCER EURO CUP 2025](https://learnquester.pages.dev/soccer-euro-cup-2025.html)
- [DINOSAURS VS ASTEROIDS](https://learnquesters.pages.dev/dinosaurs-vs-asteroids.html)
- [CATEGORY TOOLS](https://learnquester.pages.dev/category-tools.html)
- [ANGRY CHIBI RUN](https://learnquesters.pages.dev/angry-chibi-run.html)
- [CATEGORY CASUAL 6](https://learnquester.pages.dev/category-casual-6.html)
- [SUPER FOOTBALL FEVER](https://learnquesters.pages.dev/super-football-fever.html)
- [OLE BUNNY](https://studyquests.github.io/ole-bunny.html)
- [CATEGORY CASUAL 7](https://learnquester.pages.dev/category-casual-7.html)
- [CATEGORY ADVENTURE](https://learnquester.pages.dev/category-adventure.html)
- [CATEGORY SNAKE40](https://learnquesters.pages.dev/category-snake40.html)
- [4 COLORS CARD MANIA](https://studyquests.github.io/4-colors-card-mania.html)
- [CODE MAZE](https://learnquesters.pages.dev/code-maze.html)
- [INDEX10](https://learnquester.pages.dev/index10.html)
- [ANNAS STORY DRESS UP DIY](https://studyquests.github.io/annas-story-dress-up-diy.html)
- [EASTER EGGVENTURE](https://studyquesthub.web.app/easter-eggventure.html)
- [CATEGORY ANIMAL215](https://studyquests.pages.dev/category-animal215.html)
- [SORTSTORE](https://studyquests.github.io/sortstore.html)
- [MY DINOSAUR LAND](https://studyquests.pages.dev/my-dinosaur-land.html)
- [CATEGORY ESCAPE](https://learnquester.pages.dev/category-escape.html)
- [VALLEY OF WOLVES AMBUSH](https://studyquests.pages.dev/valley-of-wolves-ambush.html)
- [CATEGORY MOBILE2 112](https://learnquesters.pages.dev/category-mobile2-112.html)
- [CATEGORY CASUAL 15](https://studyquests.github.io/category-casual-15.html)
- [CATEGORY FASHION105](https://learnquesters.pages.dev/category-fashion105.html)
- [AIR BLOCK](https://learnquester.pages.dev/air-block.html)
- [EMERGENCY OPERATOR](https://learnquester.pages.dev/emergency-operator.html)
- [BARBEE SUMMER VACATION](https://studyquesthub.web.app/barbee-summer-vacation.html)
- [CATEGORY CAN T STOP PLAYING215](https://learnquester.pages.dev/category-can-t-stop-playing215.html)
- [ELITE CHESS](https://studyquests.pages.dev/elite-chess.html)
- [CATEGORY CONTROLLER](https://learnquester.pages.dev/category-controller.html)
- [CATEGORY FOOTBALL](https://learnquesters.pages.dev/category-football.html)
- [CATEGORY ART](https://quizverses.github.io/category-art.html)
- [CATEGORY RACING DRIVING](https://learnquesters.pages.dev/category-racing-driving.html)
- [ARCADE GP](https://learnquesters.pages.dev/arcade-gp.html)
- [BLUE HEDGEHOG HILL DASH RIDE](https://studyplaying.github.io/blue-hedgehog-hill-dash-ride.html)
- [HIPPO SUPERMARKET](https://studyquests.pages.dev/hippo-supermarket.html)
- [CATEGORY CASUAL 13](https://studyplaying.github.io/category-casual-13.html)
- [KAWAII REALM ADVENTURE](https://studyquests.pages.dev/kawaii-realm-adventure.html)
- [ZOOMA DRAGON](https://quizverses.github.io/zooma-dragon.html)
- [ALPHABET MERGE AND FIGHT](https://learnquesters.pages.dev/alphabet-merge-and-fight.html)
- [PAWS OFF MY CLUES](https://learnquesters.pages.dev/paws-off-my-clues.html)
- [CATEGORY MATCH 3117](https://studyquests.pages.dev/category-match-3117.html)
- [CATEGORY SOCCER 2](https://learnquesters.pages.dev/category-soccer-2.html)
- [KING KONG CHAOS](https://learnquesters.pages.dev/king-kong-chaos.html)
- [SUDOKU RELAX](https://studyquests.github.io/sudoku-relax.html)
- [MADNESS SHERIFFS COMPOUND OFFICIAL](https://quizverses-9d2f2.web.app/madness-sheriffs-compound-official.html)
- [CATEGORY UNBLOCKEDGAMES](https://studyquests.github.io/category-unblockedgames.html)
- [CATEGORY DIRT BIKE](https://studyquests.pages.dev/category-dirt-bike.html)
- [MATCH DREAM GARDEN](https://studyquests.github.io/match-dream-garden.html)
- [3D BLOCK GLADIATOR SWORD DRAW](https://learnquesters.pages.dev/3d-block-gladiator-sword-draw.html)
- [DEFORM IT](https://studyquesthub.web.app/deform-it.html)
- [CATEGORY ANIMAL216](https://quizverses.github.io/category-animal216.html)
- [DOLPHIN COUPLE UNDERWATER DRESS UP](https://learnquesters.pages.dev/dolphin-couple-underwater-dress-up.html)
- [INDEX4](https://learnquester.pages.dev/index4.html)
- [HIGH HEELS 2](https://studyquesthub.web.app/high-heels-2.html)
- [PUSHIO](https://learnquesters.pages.dev/pushio.html)
- [TWILIGHT SOLITAIRE TRIPEAKS](https://quizverses-9d2f2.web.app/twilight-solitaire-tripeaks.html)
- [CATEGORY FUN MAKEUP GAMES](https://learnquesters.pages.dev/category-fun-makeup-games.html)
- [MOTO CABBIE SIMULATOR](https://quizverses.github.io/moto-cabbie-simulator.html)
- [HALLOWEEN STICKMAN](https://studyquests.github.io/halloween-stickman.html)
- [2048 RUN GORGEOUS BALLS](https://learnquesters.pages.dev/2048-run-gorgeous-balls.html)
- [BROKEN CITY COMBAT](https://quizverses.pages.dev/broken-city-combat.html)
- [BLOONS SURVIVALIO](https://quizverses.github.io/bloons-survivalio.html)
- [PORTAL TD TOWER DEFENSE](https://learnquester.pages.dev/portal-td-tower-defense.html)
- [CHICKEN WILD RUN](https://studyquests.pages.dev/chicken-wild-run.html)
- [CATEGORY MAHJONG 2](https://learnquesters.pages.dev/category-mahjong-2.html)
- [ASTRAL ESCAPE](https://learnquesters.pages.dev/astral-escape.html)
- [POPPING SUSHI](https://learnquesters.pages.dev/popping-sushi.html)
- [POPPING CANDIES](https://learnquesters.pages.dev/popping-candies.html)
- [CATEGORY GROW99](https://learnquester.pages.dev/category-grow99.html)
- [CUBES 2048IO](https://learnquesters.pages.dev/cubes-2048io.html)
- [WATER SHOOTER](https://studyquests.github.io/water-shooter.html)
- [HEXA TAP AWAY](https://learnquester.pages.dev/hexa-tap-away.html)
- [CATEGORY WAR](https://studyquests.github.io/category-war.html)
- [INDEX16](https://learnquester.pages.dev/index16.html)
- [BURGER CATCH](https://learnquester.pages.dev/burger-catch.html)
- [CATEGORY CONTROLLER 3](https://thelearnquesters.pages.dev/category-controller-3.html)
- [CATEGORY DRESS UP](https://studyquests.github.io/category-dress-up.html)
- [SEA MATCH](https://quizverses-9d2f2.web.app/sea-match.html)
- [BUNNY BOY ONLINE](https://quizverses.github.io/bunny-boy-online.html)
- [BUBBLE AROUND](https://quizverses-9d2f2.web.app/bubble-around.html)
- [BACK 2 SCHOOL MAKEOVER](https://quizverses.pages.dev/back-2-school-makeover.html)
- [COLLEGE GIRLS TEAM MAKEOVER](https://learnquesters.pages.dev/college-girls-team-makeover.html)
- [CATEGORY BASKETBALL 3](https://quizverses.github.io/category-basketball-3.html)
- [SNOW ROAD PUZZLE](https://learnquesters.pages.dev/snow-road-puzzle.html)
- [SPA EMPIRE](https://thelearnquesters.pages.dev/spa-empire.html)
- [CATEGORY BRAIN261](https://studyquests.pages.dev/category-brain261.html)
- [DOGES BATTLE ROYALE](https://studyquests.pages.dev/doges-battle-royale.html)
- [OBBY PRISON RUN](https://studyquests.pages.dev/obby-prison-run.html)
- [SHAPE TRANSFORM RACE](https://studyquesthub.web.app/shape-transform-race.html)
- [BATTLE ISLAND 2](https://studyquests.github.io/battle-island-2.html)
- [HIPPO SUPERMARKET](https://thelearnquesters.pages.dev/hippo-supermarket.html)
- [CATEGORY SCHOOL](https://thequizzone.pages.dev/category-school.html)
- [FLAMES FORTUNE](https://learnquester.pages.dev/flames-fortune.html)
- [WOOD BLOCKS JAM](https://quizverses.github.io/wood-blocks-jam.html)
- [THREAD MATCH 2](https://thequizzone.pages.dev/thread-match-2.html)
- [INDEX3](https://thequizzone.pages.dev/index3.html)
- [CATEGORY MOBILE2 112](https://thequizzone.pages.dev/category-mobile2-112.html)
- [DINOSAURS VS ASTEROIDS](https://studyquests.github.io/dinosaurs-vs-asteroids.html)
- [CATEGORY THINKY 2](https://learnquesters.pages.dev/category-thinky-2.html)
- [MATCH MASTER](https://studyquesthub.web.app/match-master.html)
- [CRAFT DRILL](https://studyquesthub.web.app/craft-drill.html)
- [SPACE SHIFT](https://thelearnquesters.pages.dev/space-shift.html)
- [STICKMAN JUMP](https://thelearnquesters.pages.dev/stickman-jump.html)
- [SPRUNKI 3D ESCAPE](https://learnquesters.pages.dev/sprunki-3d-escape.html)
- [INDEX3](https://studyquests.pages.dev/index3.html)
- [YOUTUBER MCRAFT 2PLAYER](https://studyquests.github.io/youtuber-mcraft-2player.html)
- [BLOCK LEGENDS](https://quizverses.github.io/block-legends.html)
- [DAILY MATCH](https://quizverses-9d2f2.web.app/daily-match.html)
- [MY HOSPITAL LEARN CARE](https://thelearnquesters.pages.dev/my-hospital-learn-care.html)
- [NO PAIN NO GAIN RAGDOLL SANDBOX](https://thelearnquesters.pages.dev/no-pain-no-gain-ragdoll-sandbox.html)
- [ANIME COUPLE AVATAR MAKER](https://quizverses-9d2f2.web.app/anime-couple-avatar-maker.html)
- [GRADUATION MAKEUP TRENDS](https://quizverses-9d2f2.web.app/graduation-makeup-trends.html)
- [DOWNTOWN PARKOUR DRIVE](https://thelearnquesters.pages.dev/downtown-parkour-drive.html)
- [CATEGORY BIKE 2](https://learnquester.pages.dev/category-bike-2.html)
- [INDEX14](https://studyquests.pages.dev/index14.html)
- [CATEGORY BOOKMARKLETS](https://learnquester.pages.dev/category-bookmarklets.html)
- [3D CHESS MASTER](https://studyquests.pages.dev/3d-chess-master.html)
- [GLAMOUR BEACHLIFE](https://studyquests.github.io/glamour-beachlife.html)
- [DINO DIGG](https://studyquesthub.web.app/dino-digg.html)
- [KNIFE UP 3D](https://quizverses.github.io/knife-up-3d.html)
- [ZOMBIE SHOOTING KING](https://studyquests.github.io/zombie-shooting-king.html)
