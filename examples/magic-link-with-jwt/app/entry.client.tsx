import { hydrate } from 'react-dom';
import { RemixBrowser } from 'remix';
import { UserProvider } from '~/lib/useUserContext';
import React from 'react';

hydrate(
  <React.StrictMode>
    <UserProvider>
      <RemixBrowser />
    </UserProvider>
  </React.StrictMode>,
  document,
);
