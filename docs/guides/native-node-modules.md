---
title: Native Node Modules
toc: false
---

# Native Node Modules

Some node packages contain a binary `.node` file that contains code that is usually written in another language and that interacts with Node through the [Node-API](https://nodejs.org/api/n-api.html) foreign function interface. This can offer substantial benefits in speed, easy concurrency/multithreading, access to native interfaces, and/or interoperability with other languages. A popular example is the `Sharp` image processing library, which uses `libvips`, a C library, to increase performance.

# Limitations

Because these files use the Node FFI, they will only run on servers or edge environments that run Node. Also, the browser cannot run these files, so their use is limited to Loaders and Actions.

# Setup 

Remix should work with these files out of the box, but you'll want to export the package that contains them from a `.server.{ts,js}` file and then import them from that file in your loaders and actions. This prevents them from being included in the browser bundle and causing errors.

# Creating Native Node Modules

If you're interested in creating a package with Node modules, look for a package that interacts with the Node API in your language of choice.For Rust, there is [napi-rs](https://napi.rs/) and [neon](https://neon-bindings.com/), and for C++ with the [Node Addon API](https://github.com/nodejs/node-addon-api).  

