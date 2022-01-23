import * as React from 'react';
import { ApolloClient, InMemoryCache } from '@apollo/client';

const isBrowser = typeof window !== 'undefined';
const initialState = isBrowser ? window.__APOLLO_STATE__ : {};

export const initApollo = (isServer = true, _env: any = {}) => {
  const headers: any = {};

  return new ApolloClient({
    cache: new InMemoryCache().restore(initialState),
    headers,
    ssrMode: isServer,
    uri: "https://rickandmortyapi.com/graphql"
  });
};

export const ApolloContext = React.createContext(initialState);
