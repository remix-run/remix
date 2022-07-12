import { CacheProvider } from "@emotion/react";
import { RemixBrowser } from "@remix-run/react";
import type { FunctionComponent } from "react";
import { useState } from "react";
import { hydrate } from "react-dom";

import { ClientStyleContext } from "./styles/context";
import { createEmotionCache } from "./styles/createEmotionCache";

const ClientCacheProvider: FunctionComponent = ({ children }) => {
  const [cache, setCache] = useState(createEmotionCache());

  const reset = () => {
    setCache(createEmotionCache());
  };

  return (
    <ClientStyleContext.Provider value={{ reset }}>
      <CacheProvider value={cache}>{children}</CacheProvider>
    </ClientStyleContext.Provider>
  );
};

hydrate(
  <ClientCacheProvider>
    <RemixBrowser />
  </ClientCacheProvider>,
  document
);
