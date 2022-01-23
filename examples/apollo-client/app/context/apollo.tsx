import * as React from 'react';
import { ApolloClient, InMemoryCache } from '@apollo/client';

const IS_BROWSER = typeof window !== 'undefined';
const GRAPHQL_URL = "https://rickandmortyapi.com/graphql"

const initialState = IS_BROWSER ? window.__APOLLO_STATE__ : {};

export const initApollo = (isServer = true, _env: any = {}) => {
  const headers: any = {};

  return new ApolloClient({
    cache: new InMemoryCache().restore(initialState),
    headers,
    ssrMode: isServer,
    uri: GRAPHQL_URL
  });
};

export const ApolloContext = React.createContext(initialState);
