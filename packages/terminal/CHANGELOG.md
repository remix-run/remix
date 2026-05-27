# `terminal` CHANGELOG

This is the changelog for [`terminal`](https://github.com/remix-run/remix/tree/main/packages/terminal). It follows [semantic versioning](https://semver.org/).

## v0.1.1

### Patch Changes

- Add explicit public API types for ANSI helper objects so generated declarations no longer depend on inference through assigned helper objects (see #11433).

## v0.1.0

### Minor Changes

- Initial release of terminal output utilities for ANSI styles, color capability detection, escape sequences, and testable terminal streams. Automatic color detection disables styles for CI, `NO_COLOR`, `TERM=dumb`, and non-TTY output streams by default, and can be overridden with the `colors` option. Style helpers include common modifiers, foreground colors, background colors, bright variants, and preserve outer styles when nested formatted strings close inner styles.

## Unreleased
