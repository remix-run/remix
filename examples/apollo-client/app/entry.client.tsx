
import * as React from 'react';
import { hydrate } from 'react-dom';
import { ApolloProvider } from '@apollo/client';
import { RemixBrowser } from 'remix';

import { initApollo } from './context/apollo';

/**
 * @name Client
 * @description Our client side application is Hydrated with any data we've
 * fetched on the server side via the Remix loader or Apollo hooks.
 */
export const Client: React.FC = (_props) => {
  const client = initApollo(false);

  return (
    <ApolloProvider client={client}>
        <RemixBrowser />
    </ApolloProvider>
  );
};

hydrate(<Client />, document);
