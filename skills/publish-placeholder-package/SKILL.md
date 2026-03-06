---
name: publish-placeholder-package
description: Publish a placeholder npm package at version 0.0.0 so package names are reserved and npm OIDC permissions can be configured before CI publishing. Use when creating a brand-new package that is not ready for full release.
---

# Publish Placeholder Package

## Overview

Use this skill to publish a minimal placeholder package to npm at `0.0.0`.
This is used to reserve the package name and unblock npm-side OIDC configuration for CI publishing.

## Workflow

1. Confirm publish target.

- Collect:
  - npm package name (for example, `@remix-run/my-package`)
  - package directory in repo (for example, `packages/my-package`)
- Validate the package does not already exist at `0.0.0`:

```sh
npm view <package-name>@0.0.0 version
```

- If it already exists, stop and report that no placeholder publish is needed.

2. Build a temporary placeholder package outside the repo.

- Always publish from a temp directory to avoid shipping real package files by mistake.
- Create the temp directory and write a minimal `package.json`:

```sh
tmp_dir="$(mktemp -d)"
cd "$tmp_dir"

cat > package.json <<'JSON'
{
  "name": "<package-name>",
  "version": "0.0.0",
  "description": "Placeholder package for Remix CI/OIDC setup",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/remix-run/remix.git",
    "directory": "<repo-package-dir>"
  },
  "publishConfig": {
    "access": "public"
  }
}
JSON
```

- Add a short README:

```sh
cat > README.md <<'MD'
# Placeholder Package

This package is a placeholder published at `0.0.0` to reserve the npm name and configure CI publish permissions.
MD
```

3. Ensure npm auth is valid (expect re-auth/OTP).

- Check session:

```sh
npm whoami
```

- If not authenticated, run:

```sh
npm login
```

- Expect npm to require a fresh login and/or one-time password. If prompted for OTP, request it from the user and continue.

4. Publish the placeholder.

- Publish with public access:

```sh
npm publish --access public
```

- If the account enforces 2FA for writes, publish with OTP:

```sh
npm publish --access public --otp <code>
```

5. Verify and report.

- Verify the published version:

```sh
npm view <package-name>@0.0.0 version
```

- Report:
  - package name
  - published version (`0.0.0`)
  - confirmation that npm package exists for OIDC permission setup

6. Clean up temp files.

```sh
rm -rf "$tmp_dir"
```

## Notes

- Keep placeholder publish minimal. Do not publish full source code for this step.
- This is a one-time bootstrap step. Normal releases should continue through CI.
