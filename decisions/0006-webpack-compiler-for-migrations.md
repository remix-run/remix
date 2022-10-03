# Webpack compiler for migrations

Date: 2022-08-03

Status: proposed

## Context

Most exisiting React apps are built on top of Webpack and many of those use Create React App.
We'd love for users who maintain those apps to be able to migrate to Remix incrementally.
That means supporting everything that their current setup allows from Day 1, even if they will eventually transition off of a Webpack-enable feature towards a Remix feature.

## Decision

Remix will provide a first-party, Webpack-based, pluggable compiler.
This compiler is **NOT** meant to be an alternative to the standard Remix compiler, but just a stepping stone for those migrating to Remix.
Support will be prioritized to those using this compiler to migrate an existing Webpack-based app to Remix.
Support will be limited for anyone using this compiler for greenfield apps.

## Consequences
