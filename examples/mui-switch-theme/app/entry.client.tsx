import React from "react";
import { useState } from "react";
import { hydrate } from "react-dom";
import { RemixBrowser } from "remix";

import { CacheProvider } from "@emotion/react";

import ClientStyleContext from "~/context/ClientStyleContext";
import createEmotionCache from "~/utils/createEmotionCache";

function ClientCacheProvider({ children }: React.PropsWithChildren<{}>) {
  const [cache, setCache] = useState(createEmotionCache());

  function reset() {
    setCache(createEmotionCache());
  }

  return (
    <ClientStyleContext.Provider value={{ reset }}>
      <CacheProvider value={cache}>{children}</CacheProvider>
    </ClientStyleContext.Provider>
  );
}

hydrate(
  <ClientCacheProvider>
    <RemixBrowser />
  </ClientCacheProvider>,
  document
);
