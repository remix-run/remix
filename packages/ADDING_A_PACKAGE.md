# How to add a package

- [ ] add folder and make sure it's a unique "name" field in `package.json`
- [ ] add to root package.json `packages` array
- [ ] update rollup config to build the package
- [ ] add root `tsconfig.json` entry and make sure pkg tsconfig is proper output dir
- [ ] add to publish scripts
- [ ] update version script
- [ ] update `.changeset/config.json` to include the package
