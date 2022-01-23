/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node/globals" />

interface Window {
    __APOLLO_STATE__: any;
}

  // Container Query Polyfill
declare module 'https://cdn.skypack.dev/container-query-polyfill';
