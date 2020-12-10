# Remix Architect Fixture

Architect is a wrapper around AWS Cloud Formation. While it's nice to have a single "yarn dev" this fixture runs in two terminal tabs. A single command is a bit tricky to make work with their project conventions. We'd rather stick to their conventions for their server and then use our conventions for our handler. That means you'll find the Remix app and all its dependencies in `src/http/any-catchall`.

```bash
# Make sure to build remix first, from the root of this repository
yarn && yarn build

# architect docs show a global install so when in Rome:
yarn global add @architect/architect

# fire up the architect server
cd fixtures/architect
arc sandbox
```

Now make a new tab:

```bash
# get into the Remix app
cd src/http/any-catchall

# install deps
yarn

# fire up the dev server
yarn dev

# open it up!
open http://localhost:3333
```
