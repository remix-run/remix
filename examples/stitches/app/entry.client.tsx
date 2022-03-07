import { hydrate } from "react-dom";
import { RemixBrowser } from "remix";
import React, { useState } from "react";
import { getCssText } from "./styles/stitches.config";
import ClientStyleContext from "./styles/client.context";

interface ClientCacheProviderProps {
  children: React.ReactNode;
}

function ClientCacheProvider({ children }: ClientCacheProviderProps) {
  const [sheet, setSheet] = useState(getCssText());

  const reset = React.useCallback(() => {
    setSheet(getCssText());
  }, []);

  return (
    <ClientStyleContext.Provider value={{ reset, sheet }}>
      {children}
    </ClientStyleContext.Provider>
  );
}

hydrate(
  <ClientCacheProvider>
    <RemixBrowser />
  </ClientCacheProvider>,
  document
);
