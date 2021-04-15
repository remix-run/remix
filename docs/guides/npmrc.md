---
title: .npmrc
disabled: true
---

- briefly introduce private registries
- show a couple ways to do it
  - home folder
  - env vars
  - why not both!
- Talk about CI
  - some let you put the npmrc file there
  - others you can use the env var

## Environment variable for NPM tokens

Alternatively, a lot our customers like to use an environment variable for their token. You can export it from your bash profile and/or set it up on your CI.

```bash
//npm.remix.run/:_authToken=${REMIX_TOKEN}
@remix-run:registry=https://npm.remix.run
```

This way you can share a repo with other people who have a Remix license without commiting it to the source code.
