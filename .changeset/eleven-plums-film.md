---
"@remix-run/dev": minor
---

Deprecate remix config `serverBuildTarget` in favor of a more flexible combination of the existing [publicPath](https://remix.run/file-conventions/remix-config#publicpath), [serverBuildPath](https://remix.run/file-conventions/remix-config#serverbuildpath), [serverDependenciesToBundle](https://remix.run/file-conventions/remix-config#serverdependenciestobundle) along with net new [serverMainFields](https://remix.run/file-conventions/remix-config#servermainfields), [serverConditions](https://remix.run/file-conventions/remix-config#serverconditions), [serverMinify](https://remix.run/file-conventions/remix-config#serverminify), and the un-deprecated [serverModuleFormat](https://remix.run/file-conventions/remix-config#servermoduleformat) and [serverPlatform](https://remix.run/file-conventions/remix-config#serverplatform) options.
